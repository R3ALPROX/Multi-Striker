const {AuditLogEvent,UserFlags}=require("discord.js");
const {scanBotSource}=require("./codeScanner");

function readFlag(flags,flag){
 if(!flags?.has)return null;
 return flags.has(flag)===true;
}

async function getBotProvenance(member){
 const user=member.user;
 const flags=user.publicFlags||user.flags;
 const discordVerifiedBot=readFlag(flags,UserFlags.VerifiedBot);
 const discordVerifiedDeveloper=readFlag(flags,UserFlags.VerifiedDeveloper);
 const accountAgeDays=Math.floor((Date.now()-user.createdTimestamp)/86400000);
 let addedBy=null;
 let addedAt=null;
 try{
  const logs=await member.guild.fetchAuditLogs({type:AuditLogEvent.BotAdd,limit:25});
  const entry=logs.entries.find(e=>e.target?.id===member.id);
  if(entry){addedBy=entry.executor?.id||null;addedAt=entry.createdTimestamp||null;}
 }catch{}
 return{
  discordVerifiedBot,
  discordVerifiedDeveloper,
  verificationStatus:discordVerifiedBot===true?"DISCORD_VERIFIED_BOT":discordVerifiedBot===false?"NOT_VERIFIED":"UNKNOWN",
  accountAgeDays,
  addedBy,
  addedAt,
  botUserId:user.id,
  username:user.username,
  globalName:user.globalName||null
 };
}

async function evaluateBotSource(member,options={}){
 const provenance=await getBotProvenance(member);
 const reasons=[];
 let score=0;
 if(provenance.discordVerifiedBot===true)score-=35;
 else if(provenance.discordVerifiedBot===false)reasons.push("Discord Verified Bot status not present");
 else reasons.push("Discord Verified Bot status unavailable");
 if(provenance.discordVerifiedDeveloper===true){score-=10;reasons.push("Discord Verified Developer flag present");}
 if(provenance.accountAgeDays<7){score+=25;reasons.push("Bot account is less than 7 days old");}
 else if(provenance.accountAgeDays<30){score+=10;reasons.push("Bot account is less than 30 days old");}
 if(!provenance.addedBy){score+=10;reasons.push("Bot installer could not be established from the audit log");}
 let code=null;
 if(options.sourcePath){
  code=scanBotSource(options.sourcePath);
  if(code.verdict==="REJECT_FOR_MANUAL_REVIEW")reasons.push("Local source scan found high-risk code patterns");
  else if(code.verdict==="REVIEW")reasons.push("Local source scan found patterns requiring review");
 }
 return{provenance,score,reasons,code};
}

module.exports={getBotProvenance,evaluateBotSource};
