const {PermissionFlagsBits}=require("discord.js");
const {getGuildConfig}=require("../../config/manager");
const DANGEROUS=["Administrator","ManageGuild","ManageRoles","ManageChannels","BanMembers","KickMembers","ManageWebhooks"];
async function inspectMemberRoleChange(entry,guild){const cfg=getGuildConfig(guild.id);if(!cfg.antinuke.strictMemberRoles)return;const added=entry.changes?.find(c=>c.key==="$add")?.new_value;if(!Array.isArray(added)||!added.length)return;const member=await guild.members.fetch(entry.targetId).catch(()=>null);if(!member)return;for(const item of added){const role=guild.roles.cache.find(r=>r.id===item.id||r.name===item.name);if(!role)continue;const dangerous=DANGEROUS.filter(p=>role.permissions.has(PermissionFlagsBits[p]));if(dangerous.length){const {processSecurityAction}=require("./detector");await processSecurityAction(guild,entry.executorId,"dangerousPermission",role.id);break;}}}
module.exports={inspectMemberRoleChange};
