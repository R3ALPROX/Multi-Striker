const { assess } = require("../intelligence/threatEngine");
const { extractFeatures } = require("./features");
const { recent, observe } = require("./baseline");

function clamp(n) { return Math.max(0, Math.min(100, Number(n) || 0)); }

function analyzeContext(input = {}) {
  if (input.guildId && input.event) observe(input.guildId, input.event);
  const learnedEvents = input.guildId ? recent(input.guildId, Number(input.windowMs) || 60000) : [];
  const merged = { ...input, recentEvents: input.recentEvents || learnedEvents };
  const features = extractFeatures(merged);
  const signals = [];

  if (input.massActions || features.destructiveRate >= 24) signals.push({ weight: 35, reason: "abnormal destructive activity" });
  if (input.permissionEscalation || features.permissionEscalation >= 20) signals.push({ weight: 30, reason: "dangerous permission escalation" });
  if (input.raidBurst || features.raidPressure >= 30) signals.push({ weight: 25, reason: "abnormal coordinated join pressure" });
  if (features.coordination >= 20) signals.push({ weight: 20, reason: "multi-actor coordination pattern" });
  if (features.untrustedPenalty && features.evidenceCount > 0) signals.push({ weight: features.untrustedPenalty, reason: "untrusted actor context" });
  if (input.targetedSecurityBot) signals.push({ weight: 20, reason: "security component targeted" });
  if (input.policyContainmentRequired) signals.push({ weight: 60, reason: "deterministic policy requires containment" });

  const out = assess(signals);
  const confidence = clamp(35 + Math.min(40, features.evidenceCount * 4) + (features.uniqueActors > 1 ? 10 : 0) + (features.destructiveEvents > 0 ? 10 : 0));
  const action = out.risk >= 85 && confidence >= 70 ? "CONTAIN" : out.risk >= 60 ? "ALERT" : out.risk >= 35 ? "VERIFY" : "MONITOR";

  return { ...out, action, confidence, features, source: "multi-striker-local-intelligence" };
}

module.exports = { analyzeContext };