const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
    EmbedBuilder
} = require("discord.js");
const { getGuildConfig, updateGuildConfig } = require("../config/manager");
const { activateRaidMode, deactivateRaidMode, getRaidModeUntil } = require("../core/antiraid/raidMode");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("antiraid")
        .setDescription("Configure Multi Striker anti-raid protection")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub.setName("status").setDescription("Show anti-raid status"))
        .addSubcommand(sub => sub.setName("enable").setDescription("Enable anti-raid"))
        .addSubcommand(sub => sub.setName("disable").setDescription("Disable anti-raid"))
        .addSubcommand(sub => sub.setName("raidmode-on").setDescription("Manually activate raid mode"))
        .addSubcommand(sub => sub.setName("raidmode-off").setDescription("Turn off raid mode")),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const config = getGuildConfig(interaction.guild.id);

        if (sub === "status") {
            const until = getRaidModeUntil(interaction.guild.id);
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle("Anti-Raid Status")
                    .addFields(
                        { name: "Enabled", value: config.antiraid.enabled ? "Yes" : "No", inline: true },
                        { name: "Join threshold", value: String(config.antiraid.joinThreshold), inline: true },
                        { name: "Window", value: config.antiraid.windowSeconds + " seconds", inline: true },
                        { name: "Raid mode", value: until ? `Active until <t:${Math.floor(until / 1000)}:R>` : "Inactive" }
                    )
                    .setTimestamp()],
                flags: MessageFlags.Ephemeral
            });
        }

        if (sub === "enable" || sub === "disable") {
            updateGuildConfig(interaction.guild.id, { antiraid: { enabled: sub === "enable" } });
            return interaction.reply({ content: `Anti-raid protection **${sub === "enable" ? "enabled" : "disabled"}**.`, flags: MessageFlags.Ephemeral });
        }

        if (sub === "raidmode-on") {
            const until = activateRaidMode(interaction.guild.id, config.antiraid.raidModeMinutes);
            return interaction.reply({ content: `Raid mode activated until <t:${Math.floor(until / 1000)}:R>.`, flags: MessageFlags.Ephemeral });
        }

        deactivateRaidMode(interaction.guild.id);
        return interaction.reply({ content: "Raid mode disabled.", flags: MessageFlags.Ephemeral });
    }
};
