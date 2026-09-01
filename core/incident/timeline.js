const { recent }=require("../intelligence/memory");
function buildTimeline(guildId,ms=3600000){return recent(guildId,ms).sort((a,b)=>a.time-b.time).map(e=>({at:new Date(e.time).toISOString(),type:e.type,summary:e.action||e.reason||e.memberId||"security event"}));}
module.exports={buildTimeline};