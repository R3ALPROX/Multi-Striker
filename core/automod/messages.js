const { PermissionFlagsBits }=require("discord.js");
const { getGuildConfig }=require("../../config/manager");
const { addHeat }=require("./heat");
const { add}=require("../intelligence/memory");
const { sendLog,securityEmbed }=require("../security/logger");
function score(message){let n=5;const text=message.content||"";if(message.mentions.users.size>=5)n+=25;if(message.mentions.roles.size>=3)n+=20;if(/(?:discord\.gg|discord(?:app)?\.com\/invite)\//i.test(text))n+=45;if(/@everyone|@here/i.test(text))n+=35;if(text.length>1200)n+=10;if(/(.)\1{12,}/.test(text))n+=15;return Math.min(100,n);}
async function inspectMessage(message){if(!message.guild||message.author.bot)return;const cfg=getGuildConfig(message.guild.id);if(!cfg.automod.enabled)return;const amount=score(message),heat=addHeat(message.guild.id,message.author.id,amount,cfg.automod.decayPerSecond);add(message.guild.id,{type:"message_heat",memberId:message.author.id,heat,amount,time:Date.now()});if(heat>=cfg.automod.heatThreshold){try{if(message.member?.moderatable)await message.member.timeout(10*60*1000,"Multi Striker adaptive anti-spam/raid heat");}catch{}await sendLog(message.guild,"security",securityEmbed("ADAPTIVE HEAT TRIGGER",`<@${message.author.id}> exceeded the message heat threshold.`,[{name:"Heat",value:String(Math.round(heat)),inline:true},{name:"Channel",value:message.channel.toString(),inline:true}])).catch(()=>{});}}
module.exports={inspectMessage};
