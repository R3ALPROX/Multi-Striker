const {PermissionFlagsBits}=require("discord.js");
const {assess}=require("../intelligence/threatEngine");
const {add}=require("../intelligence/memory");
const dangerous=["Administrator","ManageGuild","ManageRoles","ManageChannels","BanMembers","KickMembers","ManageWebhooks"];
async function inspectBot(member){const signals=[];const found=dangerous.filter(p=>member.permissions.has(PermissionFlagsBits[p]));if(found.includes("Administrator"))signals.push({weight:40,reason:"Administrator capability"});if(found.length>=4)signals.push({weight:25,reason:"Multiple destructive capabilities"});if(found.includes("ManageWebhooks"))signals.push({weight:10,reason:"Webhook management capability"});const result=assess(signals);add(member.guild.id,{type:"bot_join",memberId:member.id,risk:result.risk,permissions:found,time:Date.now()});return{...result,dangerousPermissions:found,action:result.risk>=60?"CONTAIN":result.risk>=35?"REVIEW":"MONITOR"};}
module.exports={inspectBot};