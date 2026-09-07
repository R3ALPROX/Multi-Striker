const { analyzeContext } = require("./analyzer");
const { callProvider } = require("./provider");
const { validateAIResult } = require("../failsafe/aiGuard");

const SAFE_ACTIONS = new Set(["MONITOR", "VERIFY", "ALERT", "CONTAIN"]);
const PLAN_ACTIONS = new Set(["MONITOR", "VERIFY", "ALERT_OWNER", "CONTAIN_MEMBER", "PANIC_MODE"]);
const PLAN_RANK = { MONITOR: 0, VERIFY: 1, ALERT_OWNER: 2, CONTAIN_MEMBER: 3, PANIC_MODE: 4 };

function normalizeResult(value, fallback) {
  if (!value || typeof value !== "object") return fallback;
  const risk = Number(value.risk);
  const action = String(value.action || "").toUpperCase();
  if (!Number.isFinite(risk) || risk < 0 || risk > 100 || !SAFE_ACTIONS.has(action)) return fallback;
  return { risk, action, reason: String(value.reason || "No reason supplied").slice(0, 500), source: value.source || "external-ai" };
}

function localDecision(input = {}) { return analyzeContext(input); }

async function decisionStage(input) {
  const fallback = localDecision(input);
  const result = await callProvider("DECISION", {
    role: "decision",
    instruction: "Assess a Discord security incident. Return JSON only: {risk:0-100, action:MONITOR|VERIFY|ALERT|CONTAIN, reason:string}. Never invent evidence.",
    incident: input
  });
  return result.ok ? normalizeResult(result.data, fallback) : { ...fallback, source: "local-decision-fallback" };
}

async function verificationStage(input, decision) {
  const localRisk = localDecision(input).risk;
  const fallback = {
    approved: input.policyContainmentRequired ? localRisk >= 70 : decision.action !== "CONTAIN" || (decision.risk >= 70 && localRisk >= 60),
    risk: Math.max(decision.risk, localRisk),
    reason: "Independent local policy and evidence check"
  };

  const result = await callProvider("VERIFY", {
    role: "verification",
    instruction: "Independently verify the proposed security decision. Return JSON only: {approved:boolean,risk:0-100,reason:string}. Reject unsupported claims or excessive actions. Deterministic security policy remains authoritative.",
    incident: input,
    proposedDecision: decision
  });
  if (!result.ok || !result.data || typeof result.data !== "object") return { ...fallback, source: "local-verification-fallback" };

  const externalRisk = Number(result.data.risk);
  const risk = Number.isFinite(externalRisk) ? Math.max(0, Math.min(100, Math.max(localRisk, externalRisk))) : fallback.risk;
  const approved = input.policyContainmentRequired ? localRisk >= 70 : result.data.approved === true && risk >= 0;
  return {
    approved,
    risk,
    reason: String(result.data.reason || fallback.reason).slice(0, 500),
    source: result.provider || "external-ai"
  };
}

function localActionPlan(input, decision, verification) {
  if (!verification.approved) return { action: "ALERT_OWNER", reason: "Verification rejected automated containment" };
  if (input.panicRecommended && verification.risk >= 80) return { action: "PANIC_MODE", reason: "Verified critical multi-vector activity" };
  if (input.policyContainmentRequired && verification.risk >= 70) return { action: "CONTAIN_MEMBER", reason: "Verified threshold breach requires containment" };
  if (decision.action === "CONTAIN" && verification.risk >= 70) return { action: "CONTAIN_MEMBER", reason: "Verified high-risk security incident" };
  if (decision.action === "ALERT" || verification.risk >= 60) return { action: "ALERT_OWNER", reason: "Verified elevated-risk incident" };
  if (decision.action === "VERIFY") return { action: "VERIFY", reason: "Additional verification required" };
  return { action: "MONITOR", reason: "Risk does not justify automated containment" };
}

async function actionStage(input, decision, verification) {
  const fallback = localActionPlan(input, decision, verification);
  const result = await callProvider("ACTION", {
    role: "action",
    instruction: "Convert a verified security decision into the smallest safe allowlisted plan. Return JSON only: {action:MONITOR|VERIFY|ALERT_OWNER|CONTAIN_MEMBER|PANIC_MODE,reason:string}. Do not invent actions.",
    incident: input,
    decision,
    verification
  });
  if (!result.ok || !result.data || !PLAN_ACTIONS.has(String(result.data.action || "").toUpperCase())) return { ...fallback, source: "local-action-fallback" };

  const proposed = { action: String(result.data.action).toUpperCase(), reason: String(result.data.reason || "External action plan").slice(0, 500) };
  const local = localActionPlan(input, decision, verification);
  const proposedRank = PLAN_RANK[proposed.action];
  const localRank = PLAN_RANK[local.action];

  // Hard policy events cannot be downgraded or upgraded by an external model.
  if (input.policyContainmentRequired && proposed.action !== local.action) return { ...local, source: "local-policy-floor" };
  // Outside hard policy events, external AI can never be more aggressive than local policy.
  if (proposedRank > localRank) return { ...local, source: "local-policy-cap" };
  return { ...proposed, source: result.provider || "external-ai" };
}

function supervisorCheck(input, decision, verification, plan) {
  const problems = [];
  const aiGuard = validateAIResult(decision);
  if (!aiGuard.valid) problems.push(aiGuard.reason);
  if (!verification || typeof verification !== "object") problems.push("Missing verification result");
  if (!PLAN_ACTIONS.has(plan?.action)) problems.push("Unsupported action plan");
  if (plan?.action === "CONTAIN_MEMBER" && (!verification.approved || verification.risk < 70)) problems.push("Containment exceeds verified risk");
  if (plan?.action === "PANIC_MODE" && (!verification.approved || verification.risk < 80)) problems.push("Panic mode exceeds verified risk");
  return { healthy: problems.length === 0, problems };
}

async function runSecurityPipeline(input) {
  const decision = await decisionStage(input);
  const verification = await verificationStage(input, decision);
  const plan = await actionStage(input, decision, verification);
  const supervisor = supervisorCheck(input, decision, verification, plan);
  if (!supervisor.healthy) return {
    safe: false,
    decision,
    verification,
    plan: { action: "ALERT_OWNER", reason: "Local supervisor blocked an unsafe AI result" },
    supervisor
  };
  return { safe: true, decision, verification, plan, supervisor };
}

module.exports = { runSecurityPipeline, decisionStage, verificationStage, actionStage, supervisorCheck };
