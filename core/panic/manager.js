const { lockdown,unlock,isLocked }=require("../lockdown/manager");
const { takeSnapshot }=require("../backups/snapshot");
const { update }=require("../security/adaptiveLevel");
const active=new Map();
async function activatePanicMode(guild,reason="Critical security threat"){if(active.has(guild.id))return active.get(guild.id);takeSnapshot(guild);const state=await lockdown(guild,reason);active.set(guild.id,{...state,reason});update(guild.id,100);return active.get(guild.id);}
async function deactivatePanicMode(guild){await unlock(guild);active.delete(guild.id);update(guild.id,0);return true;}
function isPanicActive(guildId){return active.has(guildId)||isLocked(guildId);}
module.exports={activatePanicMode,deactivatePanicMode,isPanicActive};