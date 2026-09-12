const { N } = require("../identity/registry");

const OPENAI_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = process.env.OPENAI_VERIFIER_MODEL || "gpt-5.6-luna";
const DEFAULT_TIMEOUT_MS = Number(process.env.OPENAI_VERIFIER_TIMEOUT_MS || 3500);

function buildPrompt(observation) {
  return [
    `You are ${N.ai.external.name}, an advisory security verifier for ${N.product.name}.`,
    "Analyze the supplied Discord security observation for consistency, ambiguity, and likely risk.",
    "You are verification-only. You MUST NOT issue commands, call tools, choose a Discord action, authorize containment, or provide operational execution instructions.",
    "The local security engine remains the sole authority for policy and actions.",
    "Return JSON only with: verdict (CONFIRMED|QUESTIONABLE|INSUFFICIENT), confidence (0-100), reasons (array of short strings), contradictions (array of short strings).",
    "Observation:",
    JSON.stringify(observation)
  ].join("\n");
}

function normalize(result) {
  const verdicts = new Set(["CONFIRMED", "QUESTIONABLE", "INSUFFICIENT"]);
  const verdict = verdicts.has(result?.verdict) ? result.verdict : "INSUFFICIENT";
  const confidence = Math.max(0, Math.min(100, Number(result?.confidence) || 0));
  return {
    provider: N.ai.external.name,
    feature: N.features.externalVerifier,
    verdict,
    confidence,
    reasons: Array.isArray(result?.reasons) ? result.reasons.slice(0, 8).map(String) : [],
    contradictions: Array.isArray(result?.contradictions) ? result.contradictions.slice(0, 8).map(String) : [],
    advisoryOnly: true,
    canAct: false,
    canExecuteTools: false,
    canApproveActions: false,
    model: DEFAULT_MODEL,
    timestamp: Date.now()
  };
}

function parseOutput(text) {
  try { return JSON.parse(text); } catch {}
  const match = String(text || "").match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

async function verify(observation = {}, options = {}) {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ...normalize(null), verdict: "INSUFFICIENT", reason: "OPENAI_API_KEY is not configured" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(options.timeoutMs || DEFAULT_TIMEOUT_MS));
  try {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: options.model || DEFAULT_MODEL, input: buildPrompt(observation) }),
      signal: controller.signal
    });
    if (!response.ok) return { ...normalize(null), reason: `External verifier HTTP ${response.status}` };
    const payload = await response.json();
    const parsed = parseOutput(payload.output_text);
    return normalize(parsed);
  } catch (error) {
    return { ...normalize(null), reason: error.name === "AbortError" ? "External verifier timeout" : "External verifier unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { verify, buildPrompt, normalize };
