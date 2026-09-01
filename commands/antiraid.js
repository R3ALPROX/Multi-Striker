const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
    EmbedBuilder
} = require("discord.js");
const { getGuildConfig, updateGuildConfig } = require("../config/manager");
const { activateRaidMode, deactivateRaidMode, getRaidModeUntil } = require("../core/antiraid/raidMode");

function ownerOnly(interaction) {
    return interaction.user.id === interaction.guild.ownerId;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("antiraid")
        .setDescription("Configure Multi Striker anti-raid protection")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub.setName("status").setDescription("Show anti-raid status"))
        .addSubcommand(sub => sub.setName("enable").setDescription("Enable anti-raid"))
        .addSubcommand(sub => sub.setName("disable").setDescription("Disable anti-raid"))
        .addSubcommand(sub => sub.setName("raidmode-on").setDescription("Manually activate raid mode"))
        .addSubcommand(sub => sub.setName("raidmode-off").setDescription("Turn off raid mode"))
        .addSubcommand(sub =>
            sub.setName("threshold").setDescription("Set join-rate detection threshold")
                .addIntegerOption(option => option.setName("joins").setDescription("Joins before raid mode").setRequired(true).setMinValue(3).setMaxValue(100))
                .addIntegerOption(option => option.setName("window").setDescription("Time window in seconds").setRequired(true).setMinValue(5).setMaxValue(300))
        )
        .addSubcommand(sub =>
            sub.setName("account-age").setDescription("Set minimum account age alert threshold")
                .addIntegerOption(option => option.setName("days").setDescription("0 disables account-age alerts").setRequired(true).setMinValue(0).setMaxValue(365))
        ),

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

        if (sub === "raidmode-off") {
            deactivateRaidMode(interaction.guild.id);
            return interaction.reply({ content: "Raid mode disabled.", flags: MessageFlags.Ephemeral });
        }

        if (!ownerOnly(interaction)) {
            return interaction.reply({ content: "Only the server owner can change anti-raid thresholds.", flags: MessageFlags.Ephemeral });
        }

        if (sub === "threshold") {
            const joins = interaction.options.getInteger("joins", true);
            const window = interaction.options.getInteger("window", true);
            updateGuildConfig(interaction.guild.id, { antiraid: { joinThreshold: joins, windowSeconds: window } });
            return interaction.reply({ content: `Raid detection set to **${joins} joins / ${window}s**.`, flags: MessageFlags.Ephemeral });
        }

        const days = interaction.options.getInteger("days", true);
        updateGuildConfig(interaction.guild.id, { antiraid: { minimumAccountAgeDays: days } });
        return interaction.reply({ content: days ? `Account-age alerts set to **${days} days**.` : "Account-age alerts disabled.", flags: MessageFlags.Ephemeral });
    }
};
