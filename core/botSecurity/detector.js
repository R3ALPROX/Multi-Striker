const { PermissionFlagsBits }=require("discord.js");
const { assess }=require("../intelligence/threatEngine");
const { add }=require("../intelligence/memory");
const dangerous=["Administrator","ManageRoles","ManageChannels","BanMembers","KickMembers","ManageWebhooks"];
async function inspectBot(member){const signals=[];const perms=member.permissions;const found=dangerous.filter(p=>perms.has(PermissionFlagsBits[p]));if(perms.has(PermissionFlagsBits.Administrator))signals.push({weight:25,reason:"Administrator capability"});if(found.length>=4)signals.push({weight:20,reason:"Multiple destructive capabilities"});const result=assess(signals);add(member.guild.id,{type:"bot_join",memberId:member.id,risk:result.risk,permissions:found});return{...result,dangerousPermissions:found,action:result.risk>=60?"REVIEW":result.risk>=35?"MONITOR":"NONE"};}
module.exports={inspectBot};