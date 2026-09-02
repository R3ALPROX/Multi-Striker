const {PermissionFlagsBits}=require("discord.js");
const {setState}=require("./state");
const required=[PermissionFlagsBits.ViewAuditLog,PermissionFlagsBits.ManageRoles,PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ModerateMembers,PermissionFlagsBits.ManageWebhooks];
const warned=new Set();
async function checkGuildHealth(guild){const me=guild.members.me||await guild.members.fetchMe().catch(()=>null);if(!me)return null;const missing=required.filter(p=>!me.permissions.has(p));const key=guild.id+":"+missing.length;if(missing.length){const state=setState(guild.id,"SAFE_MODE","Multi Striker lost required permissions");if(!warned.has(key)){warned.add(key);try{const owner=await guild.fetchOwner();await owner.send(`⚠️ Multi Striker protection degraded in **${guild.name}**. Missing required permissions. Security automation is in SAFE_MODE until permissions are restored.`);}catch{}}return state;}return null;}
function startHealthMonitor(client){setInterval(()=>{for(const guild of client.guilds.cache.values())checkGuildHealth(guild).catch(()=>{});},60000).unref?.();}
module.exports={checkGuildHealth,startHealthMonitor};
