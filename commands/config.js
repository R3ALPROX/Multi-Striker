const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType
} = require("discord.js");

const {
    getGuildConfig,
    updateGuildConfig
} = require("../config/manager");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("config")
        .setDescription("Configure Multi Striker")

        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator.toString()
        )

        .addSubcommand(sub =>
            sub
                .setName("security")
                .setDescription("Configure security settings")

                .addRoleOption(option =>
                    option
                        .setName("role")
                        .setDescription(
                            "Role required for dangerous actions"
                        )
                        .setRequired(true)
                )

                .addRoleOption(option =>
                    option
                        .setName("notification_role")
                        .setDescription(
                            "Role to notify for dangerous actions"
                        )
                        .setRequired(false)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("log")
                .setDescription("Configure a log channel")

                .addStringOption(option =>
                    option
                        .setName("type")
                        .setDescription("Log type")
                        .setRequired(true)

                        .addChoices(
                            {
                                name: "Moderation",
                                value: "moderation"
                            },
                            {
                                name: "Channels",
                                value: "channels"
                            },
                            {
                                name: "Roles",
                                value: "roles"
                            },
                            {
                                name: "Members",
                                value: "members"
                            },
                            {
                                name: "Messages",
                                value: "messages"
                            },
                            {
                                name: "Voice",
                                value: "voice"
                            },
                            {
                                name: "Security",
                                value: "security"
                            },
                            {
                                name: "Backups",
                                value: "backups"
                            },
                            {
                                name: "Bot",
                                value: "bot"
                            },
                            {
                                name: "Temporary Channels",
                                value: "temporaryChannels"
                            }
                        )
                )

                .addChannelOption(option =>
                    option
                        .setName("channel")
                        .setDescription("Log channel")
                        .addChannelTypes(
                            ChannelType.GuildText
                        )
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("temporary")
                .setDescription(
                    "Configure temporary channels"
                )

                .addChannelOption(option =>
                    option
                        .setName("category")
                        .setDescription(
                            "Temporary channel category"
                        )
                        .addChannelTypes(
                            ChannelType.GuildCategory
                        )
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("view")
                .setDescription(
                    "View Multi Striker configuration"
                )
        ),

    async execute(interaction) {

        if (!interaction.guild) {
            return interaction.reply({
                content:
                    "❌ This command can only be used in a server.",
                ephemeral: true
            });
        }

        if (
            !interaction.memberPermissions.has(
                PermissionFlagsBits.Administrator
            )
        ) {
            return interaction.reply({
                content:
                    "❌ You need Administrator permission.",
                ephemeral: true
            });
        }

        const subcommand =
            interaction.options.getSubcommand();

        if (subcommand === "security") {

            const role =
                interaction.options.getRole("role");

            const notificationRole =
                interaction.options.getRole(
                    "notification_role"
                );

            updateGuildConfig(
                interaction.guild.id,
                {
                    security: {
                        dangerousActionRoleId:
                            role.id,

                        notificationRoleId:
                            notificationRole?.id ?? null
                    }
                }
            );

            return interaction.reply({
                content:
                    `✅ Security configured.\n\n` +
                    `🛡️ Dangerous-action role: ${role}\n` +
                    `🚨 Notification role: ${
                        notificationRole ??
                        "Not configured"
                    }`,
                ephemeral: true
            });
        }

        if (subcommand === "log") {

            const type =
                interaction.options.getString("type");

            const channel =
                interaction.options.getChannel("channel");

            updateGuildConfig(
                interaction.guild.id,
                {
                    logs: {
                        [type]: channel.id
                    }
                }
            );

            return interaction.reply({
                content:
                    `✅ ${type} logs → ${channel}`,
                ephemeral: true
            });
        }

        if (subcommand === "temporary") {

            const category =
                interaction.options.getChannel(
                    "category"
                );

            updateGuildConfig(
                interaction.guild.id,
                {
                    temporaryChannels: {
                        categoryId: category.id,
                        enabled: true
                    }
                }
            );

            return interaction.reply({
                content:
                    `✅ Temporary channels enabled.\n\n` +
                    `📁 Category: ${category}`,
                ephemeral: true
            });
        }

        if (subcommand === "view") {

            const config =
                getGuildConfig(
                    interaction.guild.id
                );

            const securityRole =
                config.security
                    .dangerousActionRoleId
                    ? `<@&${config.security.dangerousActionRoleId}>`
                    : "Not configured";

            const notificationRole =
                config.security
                    .notificationRoleId
                    ? `<@&${config.security.notificationRoleId}>`
                    : "Not configured";

            const category =
                config.temporaryChannels
                    .categoryId
                    ? `<#${config.temporaryChannels.categoryId}>`
                    : "Not configured";

            return interaction.reply({
                content:
                    `## ⚙️ Multi Striker\n\n` +
                    `### 🔐 Security\n` +
                    `Dangerous role: ${securityRole}\n` +
                    `Notification role: ${notificationRole}\n\n` +
                    `### ⏱️ Temporary Channels\n` +
                    `Enabled: ${
                        config.temporaryChannels.enabled
                            ? "Yes"
                            : "No"
                    }\n` +
                    `Category: ${category}`,
                ephemeral: true
            });
        }
    }
};