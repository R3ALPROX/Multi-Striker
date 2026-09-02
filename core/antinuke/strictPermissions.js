const {PermissionFlagsBits}=require("discord.js");
const {getGuildConfig}=require("../../config/manager");
const DANGEROUS=PermissionFlagsBits.Administrator|PermissionFlagsBits.ManageGuild|PermissionFlagsBits.ManageRoles|PermissionFlagsBits.ManageChannels|PermissionFlagsBits.BanMembers|PermissionFlagsBits.KickMembers|PermissionFlagsBits.ManageWebhooks;
function parseBits(value){try{return typeof value==="bigint"?value:BigInt(String(value||0));}catch{return 0n;}}
async function inspectRolePermissionChange(entry,guild){const cfg=getGuildConfig(guild.id);if(!cfg.antinuke.strictPermissions)return;const change=entry.changes?.find(c=>c.key==="permissions");if(!change)return;const before=parseBits(change.old_value),after=parseBits(change.new_value),added=after&~before;if((added&DANGEROUS)===0n)return;const {processSecurityAction}=require("./detector");await processSecurityAction(guild,entry.executorId,"dangerousPermission",entry.targetId);}
module.exports={inspectRolePermissionChange};