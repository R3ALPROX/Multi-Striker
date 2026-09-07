const { getAIConfig } = require("../../config/ai");
const { extractFeatures, clamp } = require("./features");
const { recent, observe } = require("./baseline");
const { recent: recentIncidents } = require("../intelligence/memory");
const { correlate } = require("../intelligence/correlation");

// The Brain is local, deterministic, explainable, and easy to extend.
// Add a feature in features.js, then add its contribution here.
function scoreFeatures(features, input, correlation) {
  const { weights } = getAIConfig();
  const signals = [];
  const add = (condition, weight, reason) => condition && signals.push({ weight, reason });

  add(features.destructiveEvents > 0, features.destructiveEvents * weights.destructive, "destructive activity");
  add(features.permissionEscalations > 0, features.permissionEscalations * weights.permissionEscalation, "dangerous permission escalation");
  add(correlation.coordinated, weights.coordination, "coordinated actors");
  add(features.joinCount > 0, Math.min(25, features.raidPressure * weights.raidPressure / 10), "join pressure");
  add(input.protectedTarget, weights.protectedTarget, "protected target involved");
  add(!input.trustedActor && features.evidenceCount > 0, weights.untrustedActor, "untrusted actor context");
  add(input.botRisk >= 50, weights.botRisk, "high-risk bot behavior");
  add(input.accelerating === true, weights.acceleration, "activity acceleration");
  add(features.repeatedActor >= 3, weights.repeatedActor, "repeated actor activity");
  add(features.multiVector === true, weights.multiVector, "multi-vector behavior");
  add(input.policyContainmentRequired, 60, "deterministic security policy requires containment");

  return signals;
}

function confidenceFor(features, correlation, input) {
  let confidence = 30;
  confidence += Math.min(30, features.evidenceCount * 3);
  confidence += Math.min(15, correlation.eventCount * 2);
  if (features.uniqueActors > 1) confidence += 10;
  if (features.destructiveEvents > 0) confidence += 10;
  if (input.serverBaselineReady) confidence += 10;
  return clamp(confidence);
}

function chooseAction(risk, confidence, input) {
  const { thresholds, confidence: limits } = getAIConfig();
  if (input.policyContainmentRequired && risk >= thresholds.contain && confidence >= limits.minimumContain) return "CONTAIN";
  if (risk >= thresholds.contain && confidence >= limits.minimumContain) return "CONTAIN";
  if (risk >= thresholds.alert) return "ALERT";
  if (risk >= thresholds.verify) return "VERIFY";
  return "MONITOR";
}

function analyze(input = {}) {
  const guildId = input.guildId;
  if (guildId && input.event) observe(guildId, input.event);

  const windowMs = Number(input.windowMs) || getAIConfig().windows.normalMs;
  const events = input.recentEvents || (guildId ? recent(guildId, windowMs) : []);
  const incidents = guildId ? recentIncidents(guildId, getAIConfig().windows.slowMs) : [];
  const merged = { ...input, recentEvents: events };
  const features = extractFeatures(merged);

  const actorCounts = Object.create(null);
  for (const event of events) {
    const actor = String(event.actorId || event.executorId || "unknown");
    actorCounts[actor] = (actorCounts[actor] || 0) + 1;
  }
  features.repeatedActor = Math.max(0, ...Object.values(actorCounts));
  features.multiVector = new Set(events.map(e => String(e.type || e.actionType || "UNKNOWN"))).size >= 3;

  const correlation = guildId ? correlate(guildId, getAIConfig().windows.slowMs) : {
    coordinated: false, strong: false, actors: [], eventCount: 0
  };

  // Recent events are intentionally weighted more heavily than old incidents.
  const acceleration = events.length >= 4 && events.length >= incidents.length / 4;
  const signals = scoreFeatures(features, { ...input, accelerating: acceleration }, correlation);
  const rawRisk = signals.reduce((sum, signal) => sum + Number(signal.weight || 0), 0);
  const risk = clamp(rawRisk);
  const confidence = confidenceFor(features, correlation, { ...input, serverBaselineReady: Boolean(guildId && events.length >= 5) });
  const action = chooseAction(risk, confidence, input);

  return {
    risk,
    confidence,
    action,
    level: risk >= 85 ? "CRITICAL" : risk >= 60 ? "HIGH" : risk >= 35 ? "ELEVATED" : risk >= 15 ? "MEDIUM" : "LOW",
    reasons: signals.map(s => s.reason),
    features,
    correlation,
    evidence: Math.min(events.length, getAIConfig().limits.maxEvidence),
    source: "multi-striker-local-brain"
  };
}

module.exports = { analyze, scoreFeatures, confidenceFor, chooseAction };
