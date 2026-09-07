const {PermissionFlagsBits}=require("discord.js");
const {assess}=require("../intelligence/threatEngine");
const {add}=require("../intelligence/memory");
const {evaluateBotSource}=require("./source");
const dangerous=["Administrator","ManageGuild","ManageRoles","ManageChannels","BanMembers","KickMembers","ManageWebhooks"];

async function inspectBot(member){
 const signals=[];
 const found=dangerous.filter(p=>member.permissions.has(PermissionFlagsBits[p]));
 const source=await evaluateBotSource(member);
 if(found.includes("Administrator"))signals.push({weight:40,reason:"Administrator capability"});
 if(found.length>=4)signals.push({weight:25,reason:"Multiple destructive capabilities"});
 if(found.includes("ManageWebhooks"))signals.push({weight:10,reason:"Webhook management capability"});
 if(source.provenance.verifiedBot)signals.push({weight:-25,reason:"Discord Verified Bot provenance"});
 if(source.provenance.verifiedDeveloper)signals.push({weight:-10,reason:"Discord Verified Developer provenance"});
 if(source.score>0)signals.push({weight:source.score,reason:source.reasons.join("; ")});
 const result=assess(signals);
 add(member.guild.id,{type:"bot_join",memberId:member.id,risk:result.risk,permissions:found,source:source.provenance,sourceReasons:source.reasons,time:Date.now()});
 return{...result,dangerousPermissions:found,source,action:result.risk>=60?"CONTAIN":result.risk>=35?"REVIEW":"MONITOR"};
}
module.exports={inspectBot};
