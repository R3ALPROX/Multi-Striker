const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, MessageFlags } = require("discord.js");
const { getGuildConfig, updateGuildConfig } = require("../config/manager");
const { runSecurityAudit } = require("../core/security/audit");

async function getOrCreateSecurityChannel(guild) {
    const existing = guild.channels.cache.find(channel =>
        channel.type === ChannelType.GuildText &&
        ["security-logs", "multi-striker-logs"].includes(channel.name)
    );
    if (existing) return existing;
    return guild.channels.create({
        name: "security-logs",
        type: ChannelType.GuildText,
        reason: "Multi Striker automatic security setup"
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("start")
        .setDescription("Automatically set up Multi Striker protection")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({ content: "Multi Striker can only be started inside a server.", flags: MessageFlags.Ephemeral });
        }

        if (interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: "Only the server owner can start Multi Striker protection.", flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const guild = interaction.guild;
        const botMember = guild.members.me;

        if (!botMember.permissions.has(PermissionFlagsBits.ViewAuditLog) ||
            !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.editReply("Multi Striker needs **View Audit Log** and **Manage Roles** before automatic protection can start.");
        }

        let logChannel;
        try {
            logChannel = await getOrCreateSecurityChannel(guild);
        } catch (error) {
            console.error("Setup channel error:", error);
            return interaction.editReply("I could not create **#security-logs**. Give Multi Striker **Manage Channels**, then run /start again.");
        }

        const current = getGuildConfig(guild.id);

        updateGuildConfig(guild.id, {
            security: { enabled: true, alertChannelId: logChannel.id, action: current.security.action || "strip_roles" },
            antinuke: { enabled: true },
            antiraid: { enabled: true },
            verification: { enabled: false },
            logs: { security: logChannel.id, raid: logChannel.id, verification: logChannel.id }
        });

        let audit = null;
        try {
            audit = await runSecurityAudit(guild);
        } catch (error) {
            console.error("Initial security audit error:", error);
        }

        const embed = new EmbedBuilder()
            .setTitle("🛡️ Multi Striker Protection Active")
            .setDescription("Automatic protection has been configured. Multi Striker is now monitoring this server.")
            .addFields(
                { name: "🔒 Anti-Nuke", value: "Active", inline: true },
                { name: "🚨 Anti-Raid", value: "Active", inline: true },
                { name: "📜 Security Logs", value: logChannel.toString(), inline: true },
                { name: "✅ Auto Verification", value: "Recommended — awaiting role selection", inline: true },
                { name: "⚡ Automatic response", value: "Suspicious destructive activity can trigger automatic containment.", inline: false },
                { name: "💡 Recommendation", value: "Multi Striker did not guess a member role. Verification is ready to be enabled once a suitable verified/member role is confirmed.", inline: false }
            )
            .setTimestamp();

        if (audit) {
            embed.addFields({ name: "🔍 Initial Security Scan", value: "Score: **" + audit.score + "/100** • Status: **" + audit.status + "**" });
        }

        await logChannel.send({ embeds: [embed] });
        await interaction.editReply("Multi Striker is ready. 🛡️ Protection is active. #security-logs was configured automatically, and verification analysis is ready as a recommendation.");
    }
};