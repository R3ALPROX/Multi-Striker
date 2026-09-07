const { enterSafeMode, emergencyShutdown } = require("../failsafe/failsafe");

const state = new Map();
const MAX_FAILURES = 3;
const WINDOW_MS = 60_000;
const MAX_ACTIONS_PER_MINUTE = 20;

function get(guildId) {
  if (!state.has(guildId)) state.set(guildId, { failures: [], actions: [], blocked: false, lastReason: null });
  return state.get(guildId);
}

function prune(bucket, now) {
  return bucket.filter(t => now - t < WINDOW_MS);
}

function inspect(guildId, pipelineResult) {
  const s = get(guildId);
  const now = Date.now();
  s.failures = prune(s.failures, now);

  if (!pipelineResult?.safe || !pipelineResult?.supervisor?.healthy) {
    s.failures.push(now);
    s.lastReason = pipelineResult?.supervisor?.problems?.join("; ") || "AI pipeline rejected";
    if (s.failures.length >= MAX_FAILURES) s.blocked = true;
    return { healthy: false, blocked: s.blocked, reason: s.lastReason };
  }

  return { healthy: !s.blocked, blocked: s.blocked, reason: s.lastReason };
}

function approveAction(guildId, action) {
  const s = get(guildId);
  const now = Date.now();
  s.actions = prune(s.actions, now);
  if (s.blocked) return { allowed: false, reason: "Local supervisor circuit breaker is open" };
  if (!action || !["MONITOR", "VERIFY", "ALERT_OWNER", "CONTAIN_MEMBER", "PANIC_MODE"].includes(action)) {
    s.failures.push(now);
    return { allowed: false, reason: "Unsupported AI action" };
  }
  if (s.actions.length >= MAX_ACTIONS_PER_MINUTE) {
    s.blocked = true;
    s.lastReason = "AI action-rate limit exceeded";
    return { allowed: false, reason: s.lastReason };
  }
  s.actions.push(now);
  return { allowed: true };
}

async function enforce(guild, inspection) {
  if (!inspection || inspection.healthy) return inspection;
  if (inspection.blocked) {
    await emergencyShutdown(guild.id, `Local AI supervisor: ${inspection.reason}`);
  } else {
    await enterSafeMode(guild.id, `Local AI supervisor: ${inspection.reason}`);
  }
  return inspection;
}

function reset(guildId) {
  state.delete(guildId);
}

module.exports = { inspect, approveAction, enforce, reset };
