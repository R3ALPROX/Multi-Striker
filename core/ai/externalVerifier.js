const { N } = require("../identity/registry");

const DEFAULT_MODEL = "gpt-realtime-2.1";
const DEFAULT_URL = "wss://api.openai.com/v1/realtime";
const DEFAULT_TIMEOUT_MS = 4500;

function sanitize(value, depth = 0) {
  if (depth > 5) return "[depth-limited]";
  if (typeof value === "string") {
    return value
      .replace(/(discord|bot|token|api[_-]?key|secret|authorization)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
      .slice(0, 12000);
  }
  if (Array.isArray(value)) return value.slice(0, 50).map(v => sanitize(v, depth + 1));
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value).slice(0, 80)) out[key] = sanitize(item, depth + 1);
    return out;
  }
  return value;
}

function disabled(reason = "External verifier is not configured") {
  return {
    enabled: false,
    available: false,
    authority: N.ai.external.authority,
    canAct: false,
    canExecuteTools: false,
    canApproveActions: false,
    verdict: "UNAVAILABLE",
    confidence: 0,
    reason
  };
}

function parseVerdict(text) {
  const raw = String(text || "").trim();
  const fenced = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    const parsed = JSON.parse(fenced);
    const verdict = String(parsed.verdict || "REVIEW").toUpperCase();
    const allowed = new Set(["BENIGN", "SUSPICIOUS", "MALICIOUS", "REVIEW"]);
    return {
      verdict: allowed.has(verdict) ? verdict : "REVIEW",
      confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)),
      rationale: String(parsed.rationale || "No rationale supplied.").slice(0, 2000),
      indicators: Array.isArray(parsed.indicators) ? parsed.indicators.slice(0, 12).map(String) : []
    };
  } catch {
    const upper = raw.toUpperCase();
    const verdict = upper.includes("MALICIOUS") ? "MALICIOUS" : upper.includes("SUSPICIOUS") ? "SUSPICIOUS" : upper.includes("BENIGN") ? "BENIGN" : "REVIEW";
    return { verdict, confidence: 0, rationale: raw.slice(0, 2000), indicators: [] };
  }
}

function verifyWithRealtimeSocket(observation, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Promise.resolve(disabled("OPENAI_API_KEY is not configured"));

  let WebSocket;
  try { WebSocket = require("ws"); } catch {
    return Promise.resolve(disabled("The ws dependency is not installed"));
  }

  const model = process.env.OPENAI_REALTIME_MODEL || DEFAULT_MODEL;
  const url = process.env.OPENAI_REALTIME_URL || DEFAULT_URL;
  const timeoutMs = Math.max(1000, Number(options.timeoutMs || process.env.OPENAI_VERIFIER_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const payload = sanitize(observation);
  const instructions = [
    `You are ${N.ai.external.name}, an external security verifier for ${N.product.name}.`,
    "You are advisory only.",
    "You have NO authority to ban, kick, timeout, quarantine, change roles, change channels, send messages, call tools, approve actions, or execute code.",
    "Evaluate only the supplied defensive security evidence.",
    "Return ONLY JSON with: verdict (BENIGN|SUSPICIOUS|MALICIOUS|REVIEW), confidence (0-100), rationale, indicators (array of short strings).",
    "Do not invent evidence. If evidence is insufficient, use REVIEW."
  ].join(" ");

  return new Promise(resolve => {
    let settled = false;
    let output = "";
    let socket;
    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { socket?.close(); } catch {}
      resolve({
        enabled: true,
        available: !!result,
        authority: N.ai.external.authority,
        canAct: false,
        canExecuteTools: false,
        canApproveActions: false,
        model,
        ...result
      });
    };
    const timer = setTimeout(() => finish({ verdict: "REVIEW", confidence: 0, rationale: "External verification timed out.", indicators: [], error: "timeout" }), timeoutMs);

    try {
      socket = new WebSocket(`${url}?model=${encodeURIComponent(model)}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "OpenAI-Safety-Identifier": `vorhex-external-verifier`
        }
      });
      socket.on("open", () => {
        socket.send(JSON.stringify({
          type: "session.update",
          session: {
            type: "realtime",
            instructions,
            tools: [],
            output_modalities: ["text"]
          }
        }));
        socket.send(JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: JSON.stringify(payload) }]
          }
        }));
        socket.send(JSON.stringify({ type: "response.create", response: { output_modalities: ["text"] } }));
      });
      socket.on("message", data => {
        let event;
        try { event = JSON.parse(data.toString()); } catch { return; }
        if (event.type === "response.output_text.delta") output += event.delta || "";
        if (event.type === "response.done") {
          const parsed = parseVerdict(output);
          finish(parsed);
        }
        if (event.type === "error") finish({ verdict: "REVIEW", confidence: 0, rationale: "External verifier returned an API error.", indicators: [], error: event.error?.message || "realtime_api_error" });
      });
      socket.on("error", error => finish({ verdict: "REVIEW", confidence: 0, rationale: "External verifier connection failed.", indicators: [], error: error.message }));
      socket.on("close", () => {
        if (!settled) finish({ verdict: "REVIEW", confidence: 0, rationale: "External verifier connection closed before a verdict was received.", indicators: [], error: "socket_closed" });
      });
    } catch (error) {
      finish({ verdict: "REVIEW", confidence: 0, rationale: "External verifier could not be initialized.", indicators: [], error: error.message });
    }
  });
}

async function verify(observation = {}, options = {}) {
  if (process.env.VORHEX_EXTERNAL_VERIFIER !== "true") return disabled("VORHEX_EXTERNAL_VERIFIER is not enabled");
  return verifyWithRealtimeSocket(observation, options);
}

module.exports = { verify, parseVerdict, sanitize, disabled };
