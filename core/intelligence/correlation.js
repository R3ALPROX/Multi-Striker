const { recent } = require("./memory");
function correlate(guildId, windowMs = 10 * 60 * 1000) {
  const events = recent(guildId, windowMs).filter(e => e.securityEvent && e.executorId);
  const by = new Map();
  for (const e of events) { const a = by.get(e.executorId) || { executorId:e.executorId, count:0, types:new Set(), first:e.time, last:e.time }; a.count++; a.types.add(e.actionType); a.first=Math.min(a.first,e.time); a.last=Math.max(a.last,e.time); by.set(e.executorId,a); }
  const actors=[...by.values()].filter(a=>a.count>=2);
  const total=actors.reduce((n,a)=>n+a.count,0);
  const distinct=actors.length;
  return { coordinated: distinct>=2 && total>=5, strong: distinct>=3 && total>=8, actors:actors.map(a=>({executorId:a.executorId,count:a.count,types:[...a.types],durationMs:a.last-a.first})), eventCount:events.length };
}
module.exports={correlate};