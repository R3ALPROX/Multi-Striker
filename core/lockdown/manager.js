const active=new Map();
async function lockdown(guild,reason="Security emergency"){
 if(active.has(guild.id))return active.get(guild.id); const changes=[];
 for(const channel of guild.channels.cache.values()){
  if(!channel.permissionOverwrites?.edit)continue;
  try{const ow=channel.permissionOverwrites.cache.get(guild.roles.everyone.id);changes.push({channelId:channel.id,allow:ow?.allow?.bitfield?.toString()||"0",deny:ow?.deny?.bitfield?.toString()||"0"});await channel.permissionOverwrites.edit(guild.roles.everyone.id,{SendMessages:false,AddReactions:false,CreatePublicThreads:false,CreatePrivateThreads:false},{reason});}catch{}
 }
 const state={time:Date.now(),reason,changes};active.set(guild.id,state);return state;
}
async function unlock(guild){const state=active.get(guild.id);if(!state)return false;for(const item of state.changes){const channel=guild.channels.cache.get(item.channelId);if(!channel)continue;try{await channel.permissionOverwrites.edit(guild.roles.everyone.id,{SendMessages:null,AddReactions:null,CreatePublicThreads:null,CreatePrivateThreads:null},{reason:"Multi Striker lockdown ended"});}catch{}}active.delete(guild.id);return true;}
function isLocked(guildId){return active.has(guildId);}
module.exports={lockdown,unlock,isLocked};