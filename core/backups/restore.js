const { getSnapshot } = require("./snapshot");
async function restoreMissing(guild, reason="Multi Striker emergency recovery") {
  const s=getSnapshot(guild.id); if(!s) return {ok:false,message:"No snapshot"};
  const result={ok:true,created:{roles:0,channels:0},errors:[]};
  const roleNames=new Set(guild.roles.cache.map(r=>r.name));
  const channelNames=new Set(guild.channels.cache.map(c=>c.name));
  for(const r of [...(s.roles||[])].sort((a,b)=>a.position-b.position)) {
    if(roleNames.has(r.name)) continue;
    try { await guild.roles.create({name:r.name,color:r.color,permissions:BigInt(r.permissions),hoist:r.hoist,mentionable:r.mentionable,reason}); result.created.roles++; }
    catch(e){ result.errors.push({type:"role",name:r.name,message:e.message}); }
  }
  for(const c of (s.channels||[])) {
    if(channelNames.has(c.name)) continue;
    try { await guild.channels.create({name:c.name,type:c.type,topic:c.topic||undefined,nsfw:c.nsfw,rateLimitPerUser:c.rateLimitPerUser||0,reason}); result.created.channels++; }
    catch(e){ result.errors.push({type:"channel",name:c.name,message:e.message}); }
  }
  return result;
}
function buildRestorePlan(guildId){const s=getSnapshot(guildId);return s?{takenAt:s.takenAt,roles:s.roles?.length||0,channels:s.channels?.length||0,mode:"SAFE_MISSING_ONLY"}:null;}
module.exports={buildRestorePlan,restoreMissing};