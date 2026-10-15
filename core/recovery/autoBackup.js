const {AuditLogEvent}=require("discord.js");
const {capture,restoreMissingStructure}=require("./backup");
const {critical}=require("../security/alerts");
const {N}=require("../identity/registry");

const destructive=new Set([
  AuditLogEvent.ChannelDelete,AuditLogEvent.RoleDelete,AuditLogEvent.WebhookDelete,
  AuditLogEvent.MemberBanAdd,AuditLogEvent.MemberKick,AuditLogEvent.IntegrationDelete
]);
const timers=new Map();
async function safeCapture(guild,opts){
  try{return await capture(guild,opts);}catch(error){console.error("[VORHEX] Backup failed:",guild.id,error);}
}
function scheduleReviewCapture(guild,reason){
  const old=timers.get(guild.id);if(old)clearTimeout(old);
  const timer=setTimeout(()=>{void safeCapture(guild,{destructive:true,reason:"pending review: "+reason});timers.delete(guild.id);},2500);
  timers.set(guild.id,timer);
}
function registerAutoBackup(client){
  
  client.on("channelCreate",channel=>{if(channel.guild)scheduleReviewCapture(channel.guild,"channel created");});
  client.on("channelUpdate",(_old,channel)=>{if(channel.guild)scheduleReviewCapture(channel.guild,"channel updated");});
  client.on("roleCreate",role=>scheduleReviewCapture(role.guild,"role created"));
  client.on("roleUpdate",(_old,role)=>scheduleReviewCapture(role.guild,"role updated"));
  client.on("guildUpdate",(_old,guild)=>scheduleReviewCapture(guild,"server settings updated"));
  client.on("guildAuditLogEntryCreate",async(entry,guild)=>{
    if(!destructive.has(entry.action))return;
    const saved=await safeCapture(guild,{destructive:true,reason:"destructive audit-log event"});
    const restore=await restoreMissingStructure(guild).catch(error=>({ok:false,reason:error.message}));
    await critical(guild,{
      title:"Backup recovery check",
      description:"A destructive audit-log event triggered secondary evidence capture and a verified-main structure recovery attempt.",
      type:N.labels.critical,actor:entry.executorId||null,targetId:entry.targetId||null,
      evidence:`action=${entry.action}; secondary=${saved?.slot||"failed"}; recovery=${restore.ok?"attempted":"not applied"}; restoredChannels=${restore.restoredChannels?.length||0}; restoredRoles=${restore.restoredRoles?.length||0}; reason=${restore.reason||"none"}`
    }).catch(error=>console.error("[VORHEX] Recovery alert failed:",error));
    scheduleReviewCapture(guild,"post-recovery state");
  });
}
module.exports={registerAutoBackup};
