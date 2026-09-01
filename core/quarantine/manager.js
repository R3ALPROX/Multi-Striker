const { PermissionFlagsBits } = require("discord.js");
const held = new Map();

async function quarantineMember(guild, memberId, reason="Security containment") {
  const member = await guild.members.fetch(memberId).catch(()=>null);
  if (!member || member.id === guild.ownerId) return {ok:false,reason:"Member unavailable or protected owner"};
  const removable = member.roles.cache.filter(r=>r.id!==guild.id && r.editable);
  const saved = [...removable.keys()];
  if (removable.size) await member.roles.remove(removable, reason);
  held.set(guild.id+":"+memberId,{saved,time:Date.now(),reason});
  return {ok:true,removed:saved.length};
}
async function releaseMember(guild, memberId, reason="Owner-approved release") {
  const key=guild.id+":"+memberId, record=held.get(key);
  if(!record) return {ok:false,reason:"Not quarantined by this process"};
  const member=await guild.members.fetch(memberId).catch(()=>null);
  if(!member) return {ok:false,reason:"Member unavailable"};
  const roles=record.saved.map(id=>guild.roles.cache.get(id)).filter(r=>r&&r.editable);
  if(roles.length) await member.roles.add(roles,reason);
  held.delete(key); return {ok:true,restored:roles.length};
}
function isQuarantined(guildId,memberId){return held.has(guildId+":"+memberId);}
module.exports={quarantineMember,releaseMember,isQuarantined};