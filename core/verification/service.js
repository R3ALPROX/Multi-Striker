const { getGuildConfig } = require("../../config/manager");
const { isRaidModeActive } = require("../antiraid/raidMode");
const { sendLog, securityEmbed } = require("../security/logger");

async function verifyMember(interaction) {
    if (!interaction.guild || !interaction.member) {
        throw new Error("Verification can only be used in a server.");
    }

    const config = getGuildConfig(interaction.guild.id);
    if (!config.verification.enabled || !config.verification.verifiedRoleId) {
        return { ok: false, message: "Verification is not configured." };
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const verifiedRole = interaction.guild.roles.cache.get(config.verification.verifiedRoleId);

    if (!verifiedRole) return { ok: false, message: "The configured verified role no longer exists." };
    if (!verifiedRole.editable) return { ok: false, message: "The verified role is above Multi Striker in the role hierarchy." };
    if (member.roles.cache.has(verifiedRole.id)) return { ok: true, already: true, message: "You are already verified." };

    await member.roles.add(verifiedRole, "Multi Striker verification");

    if (config.verification.unverifiedRoleId) {
        const unverified = interaction.guild.roles.cache.get(config.verification.unverifiedRoleId);
        if (unverified?.editable && member.roles.cache.has(unverified.id)) {
            await member.roles.remove(unverified, "Multi Striker verification completed");
        }
    }

    await sendLog(interaction.guild, "verification", securityEmbed(
        "Member verified",
        `<@${member.id}> completed verification.`,
        [
            { name: "Raid mode active", value: isRaidModeActive(interaction.guild.id) ? "Yes" : "No", inline: true }
        ]
    ));

    return { ok: true, message: "Verification complete." };
}

module.exports = { verifyMember };
