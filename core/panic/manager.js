const { lockdown }=require("../lockdown/manager");
const { takeSnapshot }=require("../backups/snapshot");
const { restoreMissing }=require("../backups/restore");
const { setState }=require("../failsafe/state");
const { sendLog,securityEmbed }=require("../security/logger");
const active=new Map();
async function triggerPanic(guild,reason,details={}){
 if(active.has(guild.id))return active.get(guild.id);
 const snapshot=takeSnapshot(guild);
 const state={active:true,startedAt:Date.now(),reason,details,preAttackSnapshot:snapshot.id,stages:["SNAPSHOT"]};
 active.set(guild.id,state);setState(guild.id,"LOCKDOWN","Panic Mode: "+reason);
 if(details.executorId){try{const { containMember }=require("../antinuke/actions");await containMember(guild,details.executorId,"Panic containment: "+reason);state.stages.push("CONTAIN");}catch{}}
 await lockdown(guild,"Multi Striker Panic: "+reason);state.stages.push("LOCKDOWN");
 await sendLog(guild,"security",securityEmbed("PANIC MODE",reason,[{name:"Stages",value:state.stages.join(" -> ")},{name:"Executor",value:details.executorId?"<@"+details.executorId+">":"Unknown"}])).catch(()=>{});
 return state;
}
async function recover(guild,reason="Owner-approved recovery"){const result=await restoreMissing(guild,reason);const state=active.get(guild.id);if(state)state.recovery=result;return result;}
function getPanic(guildId){return active.get(guildId)||null;}function clearPanic(guildId){active.delete(guildId);return true;}
module.exports={triggerPanic,recover,getPanic,clearPanic};