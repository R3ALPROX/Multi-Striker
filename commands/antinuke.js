const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
    EmbedBuilder
} = require("discord.js");
const { getGuildConfig, updateGuildConfig } = require("../config/manager");

const THRESHOLD_CHOICES = [
    ["Channel create", "channelCreate"],
    ["Channel delete", "channelDelete"],
    ["Role create", "roleCreate"],
    ["Role delete", "roleDelete"],
    ["Role update", "roleUpdate"],
    ["Member ban", "ban"],
    ["Member kick", "kick"],
    ["Webhook create", "webhookCreate"]
];

function ownerOnly(interaction) {
    return interaction.user.id === interaction.guild.ownerId;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("antinuke")
        .setDescription("Configure Multi Striker anti-nuke protection")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub.setName("status").setDescription("Show anti-nuke status"))
        .addSubcommand(sub => sub.setName("enable").setDescription("Enable anti-nuke"))
        .addSubcommand(sub => sub.setName("disable").setDescription("Disable anti-nuke"))
        .addSubcommand(sub =>
            sub.setName("action").setDescription("Set automatic containment action")
                .addStringOption(option => option.setName("type").setDescription("Containment action").setRequired(true)
                    .addChoices(
                        { name: "Strip roles + timeout (recommended)", value: "strip_roles" },
                        { name: "Timeout", value: "timeout" },
                        { name: "Ban", value: "ban" }
                    ))
        )
        .addSubcommand(sub =>
            sub.setName("threshold").setDescription("Set a destructive-action threshold")
                .addStringOption(option => option.setName("type").setDescription("Action type").setRequired(true)
                    .addChoices(...THRESHOLD_CHOICES.map(([name, value]) => ({ name, value }))))
                .addIntegerOption(option => option.setName("count").setDescription("Actions allowed inside the window before containment").setRequired(true).setMinValue(2).setMaxValue(50))
        )
        .addSubcommand(sub =>
            sub.setName("window").setDescription("Set anti-nuke detection window")
                .addIntegerOption(option => option.setName("seconds").setDescription("Detection window in seconds").setRequired(true).setMinValue(3).setMaxValue(120))
        )
        .addSubcommand(sub =>
            sub.setName("trust-user").setDescription("Add or remove a trusted user")
                .addStringOption(option => option.setName("mode").setDescription("Operation").setRequired(true)
                    .addChoices({ name: "Add", value: "add" }, { name: "Remove", value: "remove" }))
                .addUserOption(option => option.setName("user").setDescription("User").setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName("trust-role").setDescription("Add or remove a trusted role")
                .addStringOption(option => option.setName("mode").setDescription("Operation").setRequired(true)
                    .addChoices({ name: "Add", value: "add" }, { name: "Remove", value: "remove" }))
                .addRoleOption(option => option.setName("role").setDescription("Role").setRequired(true))
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const config = getGuildConfig(interaction.guild.id);

        if (sub === "status") {
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle("Anti-Nuke Status")
                    .addFields(
                        { name: "Enabled", value: config.antinuke.enabled ? "Yes" : "No", inline: true },
                        { name: "Containment", value: config.security.action, inline: true },
                        { name: "Window", value: config.antinuke.windowSeconds + " seconds", inline: true },
                        ...Object.entries(config.antinuke.thresholds).map(([key, value]) => ({
                            name: key.replace(/([A-Z])/g, " $1"),
                            value: String(value),
                            inline: true
                        }))
                    )
                    .setTimestamp()],
                flags: MessageFlags.Ephemeral
            });
        }

        if (sub === "enable" || sub === "disable") {
            updateGuildConfig(interaction.guild.id, { antinuke: { enabled: sub === "enable" } });
            return interaction.reply({ content: `Anti-nuke protection **${sub === "enable" ? "enabled" : "disabled"}**.`, flags: MessageFlags.Ephemeral });
        }

        if (!ownerOnly(interaction)) {
            return interaction.reply({ content: "Only the server owner can change thresholds, containment actions, or trusted identities.", flags: MessageFlags.Ephemeral });
        }

        if (sub === "action") {
            const type = interaction.options.getString("type", true);
            updateGuildConfig(interaction.guild.id, { security: { action: type } });
            return interaction.reply({ content: `Containment action set to **${type}**.`, flags: MessageFlags.Ephemeral });
        }

        if (sub === "threshold") {
            const type = interaction.options.getString("type", true);
            const count = interaction.options.getInteger("count", true);
            updateGuildConfig(interaction.guild.id, { antinuke: { thresholds: { [type]: count } } });
            return interaction.reply({ content: `Threshold for **${type}** set to **${count}**.`, flags: MessageFlags.Ephemeral });
        }

        if (sub === "window") {
            const seconds = interaction.options.getInteger("seconds", true);
            updateGuildConfig(interaction.guild.id, { antinuke: { windowSeconds: seconds } });
            return interaction.reply({ content: `Anti-nuke window set to **${seconds} seconds**.`, flags: MessageFlags.Ephemeral });
        }

        const mode = interaction.options.getString("mode", true);
        const key = sub === "trust-user" ? "trustedUserIds" : "trustedRoleIds";
        const id = sub === "trust-user"
            ? interaction.options.getUser("user", true).id
            : interaction.options.getRole("role", true).id;

        if (sub === "trust-role" && id === interaction.guild.id && mode === "add") {
            return interaction.reply({ content: "You cannot trust the @everyone role.", flags: MessageFlags.Ephemeral });
        }

        const list = [...config.security[key]];
        const index = list.indexOf(id);
        if (mode === "add" && index === -1) list.push(id);
        if (mode === "remove" && index !== -1) list.splice(index, 1);

        updateGuildConfig(interaction.guild.id, { security: { [key]: list } });
        return interaction.reply({ content: `Trusted ${sub === "trust-user" ? "user" : "role"} list updated.`, flags: MessageFlags.Ephemeral });
    }
};
