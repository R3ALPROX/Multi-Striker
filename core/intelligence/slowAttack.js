const { add, recent } = require("./memory");
const { assess } = require("./threatEngine");
const WINDOW = 30 * 60 * 1000;
const DESTRUCTIVE = new Set(["channelDelete","channelCreate","roleDelete","roleCreate","roleUpdate","ban","kick","webhookCreate","integration","dangerousPermission","permissionOverwrite"]);
async function recordAndAssess(guildId, event) {
  add(guildId, { ...event, securityEvent: true });
  const events = recent(guildId, WINDOW).filter(e => e.securityEvent && DESTRUCTIVE.has(e.actionType));
  const by = new Map();
  for (const e of events) { if (!e.executorId) continue; const a = by.get(e.executorId) || []; a.push(e); by.set(e.executorId, a); }
  const signals = [];
  for (const [executorId, a] of by) {
    const types = new Set(a.map(e => e.actionType));
    if (a.length >= 4 && types.size >= 2) signals.push({ weight: 55, reason: "Slow multi-vector attack pattern", executorId });
    if (types.has("dangerousPermission") && (types.has("channelDelete") || types.has("roleDelete"))) signals.push({ weight: 35, reason: "Permission escalation followed by destruction", executorId });
    if (a.length >= 6 && types.size >= 3) signals.push({ weight: 25, reason: "Extended distributed destructive sequence", executorId });
  }
  return { ...assess(signals), events: events.length };
}
module.exports = { recordAndAssess };