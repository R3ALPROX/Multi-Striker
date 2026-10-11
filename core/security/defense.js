const {AuditLogEvent}=require("discord.js");
const {getGuildConfig}=require("../config/store");
const {N}=require("../identity/registry");
const {contain}=require("./actions");
const {critical,alert}=require("./alerts");

const messageWindows=new Map();
const destructiveWindows=new Map();
const destructiveActions=new Set([
  AuditLogEvent.ChannelDelete,
  AuditLogEvent.RoleDelete,
  AuditLogEvent.MemberBanAdd,
  AuditLogEvent.MemberKick,
  AuditLogEvent.WebhookDelete,
  AuditLogEvent.IntegrationDelete
]);

function pushWindow(map,key,windowMs){
  const now=Date.now();
  const list=(map.get(key)||[]).filter(item=>now-item.time<=windowMs);
  list.push({time:now});
  map.set(key,list);
  return list.length;
}

function registerDefense(client){
  client.on("messageCreate",async message=>{
    if(!message.guild||message.author.bot||!message.member)return;
    const cfg=getGuildConfig(message.guild.id);
    if(!cfg.security?.initialized||!cfg.security?.enabled)return;
    if(message.member.permissions.has("ManageMessages")||message.member.permissions.has("Administrator"))return;

    const key=message.guild.id+":"+message.author.id;
    const count=pushWindow(messageWindows,key,8000);
    const content=String(message.content||"").trim().toLowerCase();
    const duplicateKey=key+":"+content.slice(0,180);
    const duplicates=content?pushWindow(messageWindows,duplicateKey,15000):0;
    const mentionCount=message.mentions.users.size+message.mentions.roles.size;
    const suspiciousLink=/(https?:\/\/|discord\.gg\/)/i.test(content);
    let reason=null;
    if(count>=8)reason="message burst (8 messages / 8 seconds)";
    else if(duplicates>=4)reason="repeated duplicate message";
    else if(mentionCount>=6)reason="mass mention burst";
    else if(suspiciousLink&&count>=4)reason="link spam burst";
    if(!reason)return;

    const result=await contain(message.guild,message.author.id,"VORHEX anti-spam: "+reason);
    await alert(message.guild,{
      title:"Anti-spam containment",
      description:"VORHEX detected a message burst and attempted containment.",
      type:N.labels.security,
      severity:N.labels.high,
      actor:message.author.id,
      action:result.action||"review",
      evidence:`${reason}; containment=${result.action||result.reason||"unknown"}`
    });
    messageWindows.delete(key);
  });

  client.on("guildAuditLogEntryCreate",async(entry,guild)=>{
    if(!destructiveActions.has(entry.action)||!entry.executorId)return;
    const cfg=getGuildConfig(guild.id);
    if(!cfg.security?.initialized||!cfg.security?.enabled)return;
    const count=pushWindow(destructiveWindows,guild.id+":"+entry.executorId,12000);
    const perAction=pushWindow(destructiveWindows,guild.id+":"+entry.executorId+":"+entry.action,12000);
    if(count<3&&perAction<2)return;

    const result=await contain(guild,entry.executorId,"VORHEX anti-nuke: destructive audit-log burst");
    await critical(guild,{
      title:"Anti-nuke containment triggered",
      description:"Multiple destructive audit-log actions occurred in a short window. VORHEX attempted to contain the executor.",
      type:N.labels.critical,
      actor:entry.executorId,
      action:result.action||"review",
      targetId:entry.targetId,
      evidence:`action=${entry.action}; burst=${count}; sameAction=${perAction}; containment=${result.action||result.reason||"unknown"}`
    });
    destructiveWindows.delete(guild.id+":"+entry.executorId);
  });
}

module.exports={registerDefense};