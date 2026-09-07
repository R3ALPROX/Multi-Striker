const { assess } = require("../intelligence/threatEngine");

const ACTIONS = new Set(["MONITOR", "VERIFY", "ALERT", "CONTAIN"]);

function supervise(input = {}, proposal = {}) {
  let action = ACTIONS.has(proposal.action) ? proposal.action : "MONITOR";
  const reasons = [];
  const evidence = Number(input.evidenceCount) || 0;
  const risk = Math.max(0, Math.min(100, Number(proposal.risk) || 0));

  if (action === "CONTAIN" && evidence < 2) {
    action = "VERIFY";
    reasons.push("containment requires independent evidence");
  }
  if (input.protectedTarget) {
    action = "MONITOR";
    reasons.push("protected target safety rule");
  }
  if (input.trustedActor && risk < 85 && action === "CONTAIN") {
    action = "ALERT";
    reasons.push("trusted actor requires stronger evidence");
  }

  const signals = [];
  if (input.massActions) signals.push({ weight: 40, reason: "mass destructive activity" });
  if (input.permissionEscalation) signals.push({ weight: 25, reason: "permission escalation" });
  if (input.raidBurst) signals.push({ weight: 30, reason: "abnormal join burst" });
  if (input.targetedSecurityBot) signals.push({ weight: 20, reason: "security component targeted" });
  const deterministic = assess(signals);

  return {
    risk: Math.max(risk, deterministic.risk),
    action,
    reasons: [...new Set([...(proposal.reasons || []), ...deterministic.reasons, ...reasons])],
    approved: action === proposal.action,
    source: "local-sentinel"
  };
}

function canExecute(input = {}, proposal = {}) {
  const checked = supervise(input, proposal);
  return {
    allowed: checked.approved && checked.action === proposal.action,
    checked,
    reason: checked.approved ? "policy-approved" : "supervisor-rejected"
  };
}

module.exports = { supervise, canExecute };