const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags,
    EmbedBuilder
} = require("discord.js");
const {
    getGuildConfig,
    updateGuildConfig,
    resetGuildConfig
} = require("../config/manager");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("config")
        .setDescription("Configure Multi Striker")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName("log").setDescription("Set a security log channel")
                .addStringOption(option =>
                    option.setName("type").setDescription("Log type").setRequired(true)
                        .addChoices(
                            { name: "Security", value: "security" },
                            { name: "Raid", value: "raid" },
                            { name: "Verification", value: "verification" }
                        ))
                .addChannelOption(option =>
                    option.setName("channel").setDescription("Log channel").setRequired(true)
                        .addChannelTypes(ChannelType.GuildText))
        )
        .addSubcommand(sub => sub.setName("view").setDescription("View current configuration"))
        .addSubcommand(sub => sub.setName("reset").setDescription("Reset Multi Striker configuration")),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === "log") {
            const type = interaction.options.getString("type", true);
            const channel = interaction.options.getChannel("channel", true);
            updateGuildConfig(interaction.guild.id, { logs: { [type]: channel.id } });
            return interaction.reply({
                content: `**${type}** logs will now be sent to ${channel}.`,
                flags: MessageFlags.Ephemeral
            });
        }

        if (sub === "reset") {
            if (interaction.user.id !== interaction.guild.ownerId) {
                return interaction.reply({ content: "Only the server owner can reset all Multi Striker configuration.", flags: MessageFlags.Ephemeral });
            }
            resetGuildConfig(interaction.guild.id);
            return interaction.reply({ content: "Multi Striker configuration has been reset to secure defaults.", flags: MessageFlags.Ephemeral });
        }

        const config = getGuildConfig(interaction.guild.id);
        return interaction.reply({
            embeds: [new EmbedBuilder()
                .setTitle("Multi Striker Configuration")
                .addFields(
                    { name: "Security", value: config.security.enabled ? "Enabled" : "Disabled", inline: true },
                    { name: "Anti-Nuke", value: config.antinuke.enabled ? "Enabled" : "Disabled", inline: true },
                    { name: "Anti-Raid", value: config.antiraid.enabled ? "Enabled" : "Disabled", inline: true },
                    { name: "Verification", value: config.verification.enabled ? "Enabled" : "Disabled", inline: true },
                    { name: "Security log", value: config.logs.security ? `<#${config.logs.security}>` : "Not set", inline: true },
                    { name: "Raid log", value: config.logs.raid ? `<#${config.logs.raid}>` : "Not set", inline: true }
                )
                .setTimestamp()],
            flags: MessageFlags.Ephemeral
        });
    }
};
