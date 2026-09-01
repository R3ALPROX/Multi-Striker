const { EmbedBuilder } = require("discord.js");
const { getGuildConfig } = require("../../config/manager");

async function sendLog(guild, type, embed) {
    const config = getGuildConfig(guild.id);
    const channelId = config.logs[type] || config.security.alertChannelId;
    if (!channelId) return;

    const channel = guild.channels.cache.get(channelId);
    if (!channel || !channel.isTextBased()) return;

    try {
        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error("Failed to send security log:", error.message);
    }
}

function securityEmbed(title, description, fields = []) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .addFields(fields)
        .setTimestamp();
}

module.exports = { sendLog, securityEmbed };
