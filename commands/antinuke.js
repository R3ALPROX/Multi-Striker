const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
    EmbedBuilder
} = require("discord.js");
const { getGuildConfig, updateGuildConfig } = require("../config/manager");

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
                        { name: "Channel deletes", value: String(config.antinuke.thresholds.channelDelete), inline: true },
                        { name: "Role deletes", value: String(config.antinuke.thresholds.roleDelete), inline: true },
                        { name: "Bans", value: String(config.antinuke.thresholds.ban), inline: true }
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
            return interaction.reply({ content: "Only the server owner can change containment actions or trusted identities.", flags: MessageFlags.Ephemeral });
        }

        if (sub === "action") {
            const type = interaction.options.getString("type", true);
            updateGuildConfig(interaction.guild.id, { security: { action: type } });
            return interaction.reply({ content: `Containment action set to **${type}**.`, flags: MessageFlags.Ephemeral });
        }

        const mode = interaction.options.getString("mode", true);
        const key = sub === "trust-user" ? "trustedUserIds" : "trustedRoleIds";
        const id = sub === "trust-user"
            ? interaction.options.getUser("user", true).id
            : interaction.options.getRole("role", true).id;
        const list = [...config.security[key]];
        const index = list.indexOf(id);

        if (mode === "add" && index === -1) list.push(id);
        if (mode === "remove" && index !== -1) list.splice(index, 1);

        updateGuildConfig(interaction.guild.id, { security: { [key]: list } });
        return interaction.reply({ content: `Trusted ${sub === "trust-user" ? "user" : "role"} list updated.`, flags: MessageFlags.Ephemeral });
    }
};
