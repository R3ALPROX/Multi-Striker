/*
 * Multi Striker Identity Registry
 * Single source of truth for public identity and user-facing feature names.
 */
const IDENTITY = {
  bot: {
    name: "Multi Striker",
    shortName: "Multi Striker",
    description: "Discord server security and protection system"
  },
  features: {
    antiNuke: "Anti-Nuke",
    antiRaid: "Anti-Raid",
    adaptiveAntiSpam: "Adaptive Anti-Spam",
    verification: "Verification",
    botGate: "Bot Gate",
    sourceVerification: "Bot Source Verification",
    contextualIntelligence: "Contextual Intelligence",
    localSecurityBrain: "Local Security Brain",
    roleAnalysis: "Role Analysis",
    permissionAnalysis: "Permission Analysis",
    behaviorAnalysis: "Behavior Analysis",
    incidentTimeline: "Incident Timeline",
    backups: "Backups",
    restore: "Safe Restore",
    lockdown: "Lockdown",
    panic: "Panic Mode",
    quarantine: "Quarantine",
    joinGate: "Join Gate",
    autoMod: "AutoMod",
    failSafe: "Fail-Safe",
    selfProtection: "Self-Protection",
    audit: "Security Audit",
    aiDecision: "Decision Intelligence",
    aiVerification: "Verification Intelligence",
    aiAction: "Action Intelligence",
    aiSupervisor: "Local Sentinel",
    aiFailover: "AI Failover",
    aiPolicy: "AI Safety Policy",
    aiExplainability: "AI Explainability",
    aiAdaptiveBaseline: "Adaptive Baseline",
    aiCorrelation: "Threat Correlation"
  },
  ai: {
    enabled: true,
    architecture: "local-security-brain-with-sentinel",
    stages: ["OBSERVE", "LEARN", "ANALYZE", "DECIDE", "SUPERVISE"],
    supervisor: "LOCAL_SENTINEL",
    externalProvidersOptional: true,
    failClosed: true
  }
};

function getIdentity() { return JSON.parse(JSON.stringify(IDENTITY)); }
function getBotName() { return IDENTITY.bot.name; }
function getFeatureName(key) { return IDENTITY.features[key] || key; }

module.exports = { IDENTITY, getIdentity, getBotName, getFeatureName };
