// Main security pipeline. Local intelligence is authoritative.
// External AI can be added later as an advisor without gaining execution authority.
const { analyze } = require("./brain");
const { canExecute } = require("./sentinel");

const PLAN_ACTIONS = new Set(["MONITOR", "VERIFY", "ALERT_OWNER", "CONTAIN_MEMBER", "PANIC_MODE"]);
const PLAN_RANK = { MONITOR: 0, VERIFY: 1, ALERT_OWNER: 2, CONTAIN_MEMBER: 3, PANIC_MODE: 4 };

function localDecision(input = {}) {
  return analyze(input);
}

function verificationStage(input, decision) {
  const secondPass = analyze({ ...input, windowMs: Math.min(Number(input.windowMs) || 60_000, 15_000) });
  const agreement = Math.abs(decision.risk - secondPass.risk) <= 30;
  const approved = agreement && secondPass.confidence >= 40;

  return {
    approved,
    risk: Math.max(decision.risk, secondPass.risk),
    confidence: secondPass.confidence,
    reason: approved ? "Independent local re-analysis agrees" : "Local re-analysis disagrees or lacks evidence",
    source: "local-verification"
  };
}

function localActionPlan(input, decision, verification) {
  if (!verification.approved) return { action: "ALERT_OWNER", reason: "Verification did not establish sufficient confidence" };
  if (input.panicRecommended && verification.risk >= 90 && verification.confidence >= 80) return { action: "PANIC_MODE", reason: "Verified critical multi-vector activity" };
  if ((input.policyContainmentRequired || decision.action === "CONTAIN") && verification.risk >= 70 && verification.confidence >= 70) return { action: "CONTAIN_MEMBER", reason: "Verified high-risk activity meets containment policy" };
  if (decision.action === "ALERT" || verification.risk >= 60) return { action: "ALERT_OWNER", reason: "Verified elevated-risk activity" };
  if (decision.action === "VERIFY") return { action: "VERIFY", reason: "More evidence is required" };
  return { action: "MONITOR", reason: "No containment threshold reached" };
}

function supervisorCheck(input, decision, verification, plan) {
  const canonical = {
    MONITOR: "MONITOR",
    VERIFY: "VERIFY",
    ALERT_OWNER: "ALERT",
    CONTAIN_MEMBER: "CONTAIN",
    PANIC_MODE: "CONTAIN"
  }[plan?.action];

  if (!PLAN_ACTIONS.has(plan?.action)) return { healthy: false, problems: ["Unsupported local action"] };

  const gate = canExecute(input, {
    risk: Math.max(decision.risk, verification.risk),
    action: canonical,
    reasons: [...decision.reasons, verification.reason]
  });

  return {
    healthy: gate.allowed,
    problems: gate.allowed ? [] : [gate.reason],
    sentinel: gate.checked
  };
}

function runSecurityPipeline(input = {}) {
  const decision = localDecision(input);
  const verification = verificationStage(input, decision);
  const plan = localActionPlan(input, decision, verification);
  const supervisor = supervisorCheck(input, decision, verification, plan);

  if (!supervisor.healthy) {
    return {
      safe: false,
      decision,
      verification,
      plan: { action: "ALERT_OWNER", reason: "Local Sentinel blocked the proposed action" },
      supervisor
    };
  }

  return { safe: true, decision, verification, plan, supervisor };
}

module.exports = { runSecurityPipeline, localDecision, verificationStage, localActionPlan, supervisorCheck, PLAN_RANK };
