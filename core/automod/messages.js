const { PermissionFlagsBits }=require("discord.js");
const { getGuildConfig }=require("../../config/manager");
const { addHeat }=require("./heat");
const { add}=require("../intelligence/memory");
const { sendLog,securityEmbed }=require("../security/logger");
const recentViolations=new Map();
function score(message,cfg){let n=5;const text=message.content||"";if(message.mentions.users.size>=5)n+=25;if(message.mentions.roles.size>=3)n+=20;if(/(?:discord\.gg|discord(?:app)?\.com\/invite)\//i.test(text))n+=45;if(/@everyone|@here/i.test(text))n+=35;if(text.length>1200)n+=10;if(/(.)\1{12,}/.test(text))n+=15;const words=Array.isArray(cfg.automod.blockedWords)?cfg.automod.blockedWords:[];const normalized=text.toLowerCase();const matched=words.filter(w=>typeof w==="string"&&w.trim()&&new RegExp(`(?:^|[^a-z0-9])${w.trim().replace(/[.*+?^${}()|[\\]\\]/g,"\\$&")}(?:$|[^a-z0-9])`,"i").test(normalized));if(matched.length)n+=Math.min(60,25+15*(matched.length-1));return{amount:Math.min(100,n),matched};}
async function inspectMessage(message){
 if(!message.guild||message.author.bot)return;
 const cfg=getGuildConfig(message.guild.id);if(!cfg.automod.enabled)return;
 const result=score(message,cfg);const heat=addHeat(message.guild.id,message.author.id,result.amount,cfg.automod.decayPerSecond);
 add(message.guild.id,{type:"message_heat",memberId:message.author.id,heat,amount:result.amount,time:Date.now(),blockedWords:result.matched});
 if(result.matched.length){
  await message.delete().catch(()=>{});
  const key=message.guild.id+":"+message.author.id;const now=Date.now();const last=recentViolations.get(key)||0;
  if(now-last>30000&&message.member?.moderatable){recentViolations.set(key,now);await message.member.timeout(10*60*1000,"Multi Striker blocked-word violation").catch(()=>{});}
  await sendLog(message.guild,"security",securityEmbed("AUTOMOD BLOCKED MESSAGE",`<@${message.author.id}> sent a blocked-word message.`,[{name:"Words detected",value:String(result.matched.length),inline:true},{name:"Channel",value:message.channel.toString(),inline:true}])).catch(()=>{});
 }
 if(heat>=cfg.automod.heatThreshold){try{if(message.member?.moderatable)await message.member.timeout(10*60*1000,"Multi Striker adaptive anti-spam/raid heat");}catch{}await sendLog(message.guild,"security",securityEmbed("ADAPTIVE HEAT TRIGGER",`<@${message.author.id}> exceeded the message heat threshold.`,[{name:"Heat",value:String(Math.round(heat)),inline:true},{name:"Channel",value:message.channel.toString(),inline:true}])).catch(()=>{});}
}
module.exports={inspectMessage};