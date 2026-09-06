const { getGuildConfig }=require("../../config/manager");
const { addHeat }=require("./heat");
const { add }=require("../intelligence/memory");
const { sendLog,securityEmbed }=require("../security/logger");
const { quarantineMember }=require("../quarantine/manager");

const violations=new Map();
const actionCooldown=new Map();

function normalize(text){return String(text||"").toLowerCase().replace(/[\u200b-\u200d\ufeff]/g,"").replace(/[^\p{L}\p{N}]+/gu," ").trim();}
function escapeRegExp(text){return String(text).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");}
function score(message,cfg){
 let n=5;const text=message.content||"";
 if(message.mentions.users.size>=5)n+=25;
 if(message.mentions.roles.size>=3)n+=20;
 if(/(?:discord\.gg|discord(?:app)?\.com\/invite)\//i.test(text))n+=45;
 if(/@everyone|@here/i.test(text))n+=35;
 if(text.length>1200)n+=10;
 if(/(.)\1{12,}/.test(text))n+=15;
 const words=Array.isArray(cfg.automod.blockedWords)?cfg.automod.blockedWords:[];
 const clean=normalize(text);
 const matched=words.filter(w=>{const word=normalize(w);return word&&new RegExp(`(^|\\s)${escapeRegExp(word)}(?=\\s|$)`,`iu`).test(clean);});
 if(matched.length)n+=Math.min(60,25+15*(matched.length-1));
 return{amount:Math.min(100,n),matched};
}
function recordViolation(guildId,memberId){
 const key=guildId+":"+memberId,now=Date.now();
 const recent=(violations.get(key)||[]).filter(t=>now-t<30000);recent.push(now);violations.set(key,recent);return recent.length;
}
async function inspectMessage(message){
 if(!message.guild)return;
 const cfg=getGuildConfig(message.guild.id);if(!cfg.automod.enabled)return;
 const result=score(message,cfg);
 const isMultiStriker=message.author.id===message.client.user.id;

 if(result.matched.length&&!isMultiStriker){
  const count=recordViolation(message.guild.id,message.author.id);
  await message.delete().catch(()=>{});
  add(message.guild.id,{type:"blocked_language",memberId:message.author.id,words:result.matched.slice(0,5),count,time:Date.now()});

  // Bots are quarantined immediately for sending configured blocked language.
  // Human members need repeated violations within 30 seconds.
  const threshold=message.author.bot?1:3;
  const key=message.guild.id+":"+message.author.id;
  if(count>=threshold&&!actionCooldown.has(key)){
   actionCooldown.set(key,Date.now());
   const containment=await quarantineMember(message.guild,message.author.id,"Multi Striker: blocked language / suspicious bot behavior").catch(error=>({ok:false,reason:error.message}));
   await sendLog(message.guild,"security",securityEmbed("AUTOMATIC QUARANTINE",`<@${message.author.id}> was quarantined by the content-security engine.`,[
    {name:"Type",value:message.author.bot?"Bot":"Member",inline:true},
    {name:"Violations",value:String(count),inline:true},
    {name:"Matched",value:result.matched.slice(0,5).join(", ").slice(0,900),inline:true},
    {name:"Result",value:containment.ok?"Quarantine applied":"Failed: "+(containment.reason||"unknown error")}
   ])).catch(()=>{});
   setTimeout(()=>actionCooldown.delete(key),60000);
  }
  return;
 }

 // Multi Striker must not accumulate its own message heat.
 if(message.author.bot)return;
 const heat=addHeat(message.guild.id,message.author.id,result.amount,cfg.automod.decayPerSecond);
 add(message.guild.id,{type:"message_heat",memberId:message.author.id,heat,amount:result.amount,time:Date.now()});
 if(heat>=cfg.automod.heatThreshold){
  const key=message.guild.id+":"+message.author.id;
  if(!actionCooldown.has(key)){
   actionCooldown.set(key,Date.now());
   try{if(message.member?.moderatable)await message.member.timeout(10*60*1000,"Multi Striker adaptive anti-spam/raid heat");}catch{}
   await sendLog(message.guild,"security",securityEmbed("ADAPTIVE HEAT TRIGGER",`<@${message.author.id}> exceeded the message heat threshold.`,[{name:"Heat",value:String(Math.round(heat)),inline:true},{name:"Channel",value:message.channel.toString(),inline:true}])).catch(()=>{});
   setTimeout(()=>actionCooldown.delete(key),60000);
  }
 }
}
module.exports={inspectMessage};
