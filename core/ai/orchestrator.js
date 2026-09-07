const { analyzeContext } = require("./analyzer");
const { canExecute } = require("./sentinel");
const { validateAIResult } = require("../failsafe/aiGuard");

const ROLES = ["DECISION", "VERIFICATION", "ACTION"];
const ALLOWED = new Set(["MONITOR", "VERIFY", "ALERT", "CONTAIN"]);

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function callProvider(provider, role, payload) {
  if (!provider?.url || !provider?.apiKey) throw new Error(`${role} provider is not configured`);
  const { signal, clear } = timeoutSignal(provider.timeoutMs || 5000);
  try {
    const response = await fetch(provider.url, {
      method: "POST", signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
      body: JSON.stringify({ role, input: payload })
    });
    if (!response.ok) throw new Error(`${role} provider HTTP ${response.status}`);
    const result = await response.json();
    const check = validateAIResult(result);
    if (!check.valid) throw new Error(check.reason);
    return { ...result, provider: provider.name || "external" };
  } finally { clear(); }
}

async function firstHealthy(providers, role, payload) {
  for (const provider of providers || []) {
    try { return await callProvider(provider, role, payload); } catch (_) {}
  }
  return null;
}

function agreement(a, b) {
  if (!a || !b || a.action !== b.action) return false;
  return Math.abs(Number(a.risk) - Number(b.risk)) <= 20;
}

async function runSecurityPipeline(input = {}, config = {}) {
  const local = analyzeContext(input);
  const providers = config.providers || {};
  const decision = await firstHealthy(providers.decision, "DECISION", { ...input, local });
  if (!decision) return { status: "DEGRADED", decision: local, verified: false, action: "MONITOR", source: "local-fallback" };

  const verification = await firstHealthy(providers.verification, "VERIFICATION", { input, decision, local });
  if (!verification || !agreement(decision, verification)) {
    return { status: "SAFE_MODE", decision, verification, verified: false, action: "MONITOR", reason: "Independent verification failed" };
  }

  const actionPlan = await firstHealthy(providers.action, "ACTION", { input, decision, verification, local });
  if (!actionPlan || !ALLOWED.has(actionPlan.action)) {
    return { status: "SAFE_MODE", decision, verification, verified: false, action: "MONITOR", reason: "Action planner unavailable or invalid" };
  }

  const gate = canExecute({ ...input, evidenceCount: input.evidenceCount || local.features.evidenceCount }, actionPlan);
  if (!gate.allowed) {
    return { status: "SUPERVISOR_BLOCKED", decision, verification, actionPlan, supervisor: gate.checked, verified: false, action: "MONITOR", reason: gate.reason };
  }

  return { status: "READY", decision, verification, action: actionPlan.action, supervisor: gate.checked, verified: true };
}

module.exports = { ROLES, runSecurityPipeline };