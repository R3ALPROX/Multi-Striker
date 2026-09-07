// Deterministic security intelligence is the safety fallback when external AI is unavailable.
const { assess } = require("../intelligence/threatEngine");

function analyzeContext(input = {}) {
  const signals = [];
  if (input.massActions) signals.push({ weight: 40, reason: "Mass destructive activity" });
  if (input.permissionEscalation) signals.push({ weight: 25, reason: "Permission escalation pattern" });
  if (input.targetedSecurityBot) signals.push({ weight: 35, reason: "Security bot targeted" });
  if (input.raidBurst) signals.push({ weight: 30, reason: "Abnormal coordinated join burst" });
  if (input.policyContainmentRequired) signals.push({ weight: 60, reason: "Deterministic security policy requires containment" });

  const out = assess(signals);
  return {
    ...out,
    action: out.risk >= 80 ? "CONTAIN" : out.risk >= 60 ? "ALERT" : out.risk >= 35 ? "VERIFY" : "MONITOR",
    source: "local-context-engine"
  };
}

module.exports = { analyzeContext };
