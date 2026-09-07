// Sentinel is the final local safety boundary. AI can recommend; Sentinel decides if it is safe.
const { analyze } = require("./brain");

const ACTIONS = new Set(["MONITOR", "VERIFY", "ALERT", "CONTAIN"]);

function clamp(n) {
  return Math.max(0, Math.min(100, Number(n) || 0));
}

function supervise(input = {}, proposal = {}) {
  const local = analyze(input);
  let action = ACTIONS.has(String(proposal.action || "").toUpperCase())
    ? String(proposal.action).toUpperCase()
    : "MONITOR";
  const reasons = [];
  const evidence = Number(input.evidenceCount || local.evidence) || 0;
  const proposedRisk = clamp(proposal.risk);
  const riskGap = Math.abs(proposedRisk - local.risk);

  // The supervisor never accepts a cloud/AI result that materially contradicts local evidence.
  if (riskGap > 30) {
    action = local.action;
    reasons.push("AI risk disagrees with local evidence");
  }

  if (action === "CONTAIN" && (evidence < 2 || local.confidence < 70 || local.risk < 70)) {
    action = "VERIFY";
    reasons.push("containment evidence or confidence is insufficient");
  }

  if (action === "CONTAIN" && local.risk < 85 && !input.policyContainmentRequired) {
    action = local.risk >= 60 ? "ALERT" : "VERIFY";
    reasons.push("local containment threshold not reached");
  }

  if (input.protectedTarget) {
    action = "MONITOR";
    reasons.push("protected target safety rule");
  }

  if (input.trustedActor && action === "CONTAIN" && local.risk < 95) {
    action = "ALERT";
    reasons.push("trusted actor requires exceptional evidence");
  }

  if (!input.guildId && action === "CONTAIN") {
    action = "VERIFY";
    reasons.push("guild context is required for automated containment");
  }

  return {
    risk: Math.max(proposedRisk, local.risk),
    localRisk: local.risk,
    confidence: local.confidence,
    action,
    reasons: [...new Set([...(proposal.reasons || []), ...local.reasons, ...reasons])],
    approved: action === proposal.action,
    source: "multi-striker-sentinel"
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
