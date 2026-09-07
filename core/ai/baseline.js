const MAX_EVENTS = 500;
const guildBaselines = new Map();

function getBaseline(guildId) {
  if (!guildBaselines.has(guildId)) {
    guildBaselines.set(guildId, {
      events: [],
      counts: Object.create(null),
      actors: Object.create(null),
      updatedAt: Date.now()
    });
  }
  return guildBaselines.get(guildId);
}

function observe(guildId, event = {}) {
  if (!guildId) return;
  const b = getBaseline(guildId);
  const now = Number(event.timestamp) || Date.now();
  const type = String(event.type || "UNKNOWN");
  const actor = String(event.actorId || "unknown");
  b.events.push({ type, actorId: actor, timestamp: now });
  if (b.events.length > MAX_EVENTS) b.events.splice(0, b.events.length - MAX_EVENTS);
  b.counts[type] = (b.counts[type] || 0) + 1;
  b.actors[actor] = (b.actors[actor] || 0) + 1;
  b.updatedAt = now;
}

function recent(guildId, windowMs = 60000) {
  const b = getBaseline(guildId);
  const cutoff = Date.now() - windowMs;
  return b.events.filter(e => e.timestamp >= cutoff);
}

function anomaly(guildId, type, windowMs = 60000) {
  const b = getBaseline(guildId);
  const recentEvents = recent(guildId, windowMs).filter(e => e.type === type).length;
  const historical = b.counts[type] || 0;
  const samples = Math.max(1, b.events.length);
  const expectedPerWindow = historical / Math.max(1, samples / Math.max(1, windowMs / 60000));
  if (expectedPerWindow <= 0) return recentEvents > 0 ? 1 : 0;
  return Math.min(1, recentEvents / Math.max(1, expectedPerWindow * 4));
}

function reset(guildId) { guildBaselines.delete(guildId); }

module.exports = { observe, recent, anomaly, getBaseline, reset };