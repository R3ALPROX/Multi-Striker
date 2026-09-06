const { getGuildConfig } = require("../../config/manager");
const { isRaidModeActive } = require("../antiraid/raidMode");
const { sendLog, securityEmbed } = require("../security/logger");

async function applyVerifiedRole(guild, member, reason="Multi Striker automatic verification") {
    const config = getGuildConfig(guild.id);
    if (!config.verification.enabled || !config.verification.verifiedRoleId) return {ok:false, reason:"Verification is not configured."};
    const verifiedRole = guild.roles.cache.get(config.verification.verifiedRoleId);
    if (!verifiedRole) return {ok:false, reason:"Verified role no longer exists."};
    if (!verifiedRole.editable) return {ok:false, reason:"Verified role is above Multi Striker."};
    if (!member.roles.cache.has(verifiedRole.id)) await member.roles.add(verifiedRole, reason);
    if (config.verification.unverifiedRoleId) {
        const unverified = guild.roles.cache.get(config.verification.unverifiedRoleId);
        if (unverified?.editable && member.roles.cache.has(unverified.id)) await member.roles.remove(unverified, "Multi Striker verification completed");
    }
    return {ok:true, roleId:verifiedRole.id};
}

async function verifyMember(interaction) {
    if (!interaction.guild || !interaction.member) throw new Error("Verification can only be used in a server.");
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const result = await applyVerifiedRole(interaction.guild, member, "Multi Striker verification");
    if (!result.ok) return {ok:false, message:result.reason};
    await sendLog(interaction.guild, "verification", securityEmbed("Member verified", `<@${member.id}> completed verification.`, [{name:"Raid mode active", value:isRaidModeActive(interaction.guild.id)?"Yes":"No", inline:true}]));
    return {ok:true, message:"Verification complete."};
}

module.exports = {verifyMember, applyVerifiedRole};
