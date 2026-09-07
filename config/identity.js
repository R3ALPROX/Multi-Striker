/*
 * Multi Striker Identity Registry
 *
 * Single source of truth for the bot's public identity and every
 * user-facing feature name. Core modules should import getIdentity().
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
    aiDecision: "Decision AI",
    aiVerification: "Verification AI",
    aiAction: "Action AI",
    aiSupervisor: "Local AI Supervisor",
    aiFailover: "AI Failover",
    aiPolicy: "AI Safety Policy"
  },
  ai: {
    enabled: true,
    architecture: "three-stage-plus-local-supervisor",
    stages: ["DECISION", "VERIFY", "ACTION"],
    supervisor: "LOCAL",
    externalProvidersOptional: true,
    failClosed: true
  }
};

function getIdentity() { return JSON.parse(JSON.stringify(IDENTITY)); }
function getBotName() { return IDENTITY.bot.name; }
function getFeatureName(key) { return IDENTITY.features[key] || key; }

module.exports = { IDENTITY, getIdentity, getBotName, getFeatureName };
