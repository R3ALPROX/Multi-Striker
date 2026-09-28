const {N}=require("../identity/registry");const {sendLog,incidentEmbed}=require("../observability/logger");const {setPanic}=require("../containment/modes");const {recordIncident}=require("../observability/dashboard");const {forwardIncident}=require("../network/reporter");const cooldown=new Map();
async function alert(guild,incident){
  recordIncident(guild,incident.severity,incident);
  const key=guild.id+":"+incident.type,now=Date.now(),last=cooldown.get(key)||0;
  const logPromise=sendLog(guild,incident).catch(()=>false);
  const networkPromise=forwardIncident({...incident,guildId:guild.id,guildName:guild.name}).catch(()=>false);
  if(now-last<30000){await Promise.allSettled([logPromise,networkPromise]);return;}
  cooldown.set(key,now);
  await Promise.allSettled([logPromise,networkPromise]);
  if(incident.severity!==N.labels.critical)return;
  const owner=await guild.fetchOwner().catch(()=>null);
  if(owner)await owner.send({embeds:[incidentEmbed(incident)]}).catch(()=>{});
}
async function critical(guild,data){setPanic(guild,true,data.description||"critical security signal");return alert(guild,{...data,severity:N.labels.critical});}module.exports={alert,critical};