const { PermissionFlagsBits }=require("discord.js");
const { processSecurityAction }=require("./detector");
const dangerous=[
  PermissionFlagsBits.Administrator,PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageRoles,PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.BanMembers,PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ManageWebhooks
];
function hasNewDangerousPermission(entry){
 const change=entry.changes?.find(c=>c.key==="permissions");
 if(!change?.new_value)return false;
 const next=BigInt(change.new_value), prev=BigInt(change.old_value||0);
 return dangerous.some(p=>(next&p)!==0n&&(prev&p)===0n);
}
async function inspectEscalation(entry,guild){
 if(!hasNewDangerousPermission(entry)) return;
 await processSecurityAction(guild,entry.executorId,"dangerousPermission",entry.targetId);
}
module.exports={inspectEscalation};