// Main security pipeline.
// The local Brain decides what the evidence suggests.
// Sentinel decides whether the proposed action is safe to pass on.
const { analyze } = require("./brain");
const { canExecute } = require("./sentinel");

const PLAN_ACTIONS = new Set(["MONITOR", "VERIFY", "ALERT_OWNER", "CONTAIN_MEMBER", "PANIC_MODE"]);

function localDecision(input = {}) {
  return analyze(input);
}

function verificationStage(input, decision) {
  const secondPass = analyze({
    ...input,
    windowMs: Math.min(Number(input.windowMs) || 60_000, 15_000)
  });

  const agreement = Math.abs(decision.risk - secondPass.risk) <= 30;
  const approved = agreement && secondPass.confidence >= 40;

  return {
    approved,
    risk: Math.max(decision.risk, secondPass.risk),
    confidence: secondPass.confidence,
    reason: approved
      ? "Independent local re-analysis agrees"
      : "Local re-analysis disagrees or lacks evidence",
    source: "local-verification"
  };
}

function localActionPlan(input, decision, verification) {
  if (!verification.approved) {
    return { action: "ALERT_OWNER", reason: "Verification did not establish sufficient confidence" };
  }

  if (input.panicRecommended && verification.risk >= 90 && verification.confidence >= 80) {
    return { action: "PANIC_MODE", reason: "Verified critical multi-vector activity" };
  }

  if ((input.policyContainmentRequired || decision.action === "CONTAIN") && verification.risk >= 70 && verification.confidence >= 70) {
    return { action: "CONTAIN_MEMBER", reason: "Verified high-risk activity meets containment policy" };
  }

  if (decision.action === "ALERT" || verification.risk >= 60) {
    return { action: "ALERT_OWNER", reason: "Verified elevated-risk activity" };
  }

  if (decision.action === "VERIFY") {
    return { action: "VERIFY", reason: "More evidence is required" };
  }

  return { action: "MONITOR", reason: "No containment threshold reached" };
}

function supervisorCheck(input, decision, verification, plan) {
  if (!PLAN_ACTIONS.has(plan?.action)) {
    return {
      healthy: false,
      allowed: false,
      problems: ["Unsupported local action"]
    };
  }

  const canonicalAction = {
    MONITOR: "MONITOR",
    VERIFY: "VERIFY",
    ALERT_OWNER: "ALERT",
    CONTAIN_MEMBER: "CONTAIN",
    PANIC_MODE: "CONTAIN"
  }[plan.action];

  const gate = canExecute(input, {
    risk: Math.max(decision.risk, verification.risk),
    action: canonicalAction,
    reasons: [...decision.reasons, verification.reason]
  });

  // `healthy` means Sentinel itself completed correctly.
  // `allowed` means Sentinel approved this particular action.
  // Keeping these separate prevents a blocked action from looking like
  // a broken security engine.
  return {
    healthy: Boolean(gate.checked),
    allowed: gate.allowed,
    problems: gate.allowed ? [] : [gate.reason],
    sentinel: gate.checked
  };
}

function runSecurityPipeline(input = {}) {
  const decision = localDecision(input);
  const verification = verificationStage(input, decision);
  const proposedPlan = localActionPlan(input, decision, verification);
  const supervisor = supervisorCheck(input, decision, verification, proposedPlan);

  if (!supervisor.allowed) {
    return {
      safe: true,
      decision,
      verification,
      plan: {
        action: "ALERT_OWNER",
        reason: "Local Sentinel blocked the proposed action"
      },
      supervisor
    };
  }

  return {
    safe: true,
    decision,
    verification,
    plan: proposedPlan,
    supervisor
  };
}

module.exports = {
  runSecurityPipeline,
  localDecision,
  verificationStage,
  localActionPlan,
  supervisorCheck
};
