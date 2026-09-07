const {AuditLogEvent,UserFlags}=require("discord.js");

async function getBotProvenance(member){
 const user=member.user;
 const flags=user.publicFlags||user.flags;
 const verifiedBot=!!flags?.has?.(UserFlags.VerifiedBot);
 const verifiedDeveloper=!!flags?.has?.(UserFlags.VerifiedDeveloper);
 const accountAgeDays=Math.floor((Date.now()-user.createdTimestamp)/86400000);
 let addedBy=null;
 let addedAt=null;
 try{
  const logs=await member.guild.fetchAuditLogs({type:AuditLogEvent.BotAdd,limit:25});
  const entry=logs.entries.find(e=>e.target?.id===member.id);
  if(entry){addedBy=entry.executor?.id||null;addedAt=entry.createdTimestamp||null;}
 }catch{}
 return{
  verifiedBot,
  verifiedDeveloper,
  accountAgeDays,
  addedBy,
  addedAt,
  applicationId:user.id,
  username:user.username,
  globalName:user.globalName||null
 };
}

async function evaluateBotSource(member){
 const provenance=await getBotProvenance(member);
 const reasons=[];
 let score=0;
 if(provenance.verifiedBot)score-=35;else reasons.push("Discord Verified Bot status not present");
 if(provenance.verifiedDeveloper)score-=10;
 if(provenance.accountAgeDays<7){score+=25;reasons.push("Bot account is less than 7 days old");}
 else if(provenance.accountAgeDays<30){score+=10;reasons.push("Bot account is less than 30 days old");}
 if(!provenance.addedBy){score+=10;reasons.push("Bot installer could not be established from the audit log");}
 return{provenance,score,reasons};
}

module.exports={getBotProvenance,evaluateBotSource};
