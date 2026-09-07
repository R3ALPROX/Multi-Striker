// Central tuning for the local security intelligence engine.
// Keep thresholds here so future upgrades do not require hunting through logic.
const AI_CONFIG = {
  windows: { fastMs: 15_000, normalMs: 60_000, slowMs: 30 * 60_000 },
  thresholds: { verify: 35, alert: 60, contain: 85, panic: 90 },
  confidence: { minimumContain: 70, minimumPanic: 80 },
  limits: { maxEvidence: 150, maxActors: 50 },
  weights: {
    destructive: 8,
    permissionEscalation: 14,
    coordination: 10,
    raidPressure: 4,
    protectedTarget: 18,
    untrustedActor: 5,
    botRisk: 8,
    acceleration: 12,
    repeatedActor: 7,
    multiVector: 15
  }
};

function getAIConfig() {
  return JSON.parse(JSON.stringify(AI_CONFIG));
}

module.exports = { AI_CONFIG, getAIConfig };
