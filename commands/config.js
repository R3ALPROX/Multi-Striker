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
            PermissionFlagsBits.Administrator
        )

        // SECURITY
        .addSubcommand(sub =>
            sub
                .setName("security")
                .setDescription(
                    "Run a server security audit"
                )
        )

        // LOG
        .addSubcommand(sub =>
            sub
                .setName("log")
                .setDescription(
                    "Configure a log channel"
                )
                .addStringOption(option =>
                    option
                        .setName("type")
                        .setDescription(
                            "Type of log"
                        )
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
                        .setDescription(
                            "Channel for logs"
                        )
                        .addChannelTypes(
                            ChannelType.GuildText
                        )
                        .setRequired(true)
                )
        )

        // TEMPORARY CHANNELS
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

        // VIEW
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

        // ================================
        // SECURITY
        // ================================

        if (subcommand === "security") {

            return interaction.reply({
                content:
                    "🛡️ **Security Audit**\n\n" +
                    "🔎 Security scanner is being prepared.\n" +
                    "The advanced role, permission, history, " +
                    "raid/nuke and AI analysis will be added here.",
                ephemeral: true
            });
        }

        // ================================
        // LOG
        // ================================

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
                    `✅ **${type}** logs → ${channel}`,
                ephemeral: true
            });
        }

        // ================================
        // TEMPORARY
        // ================================

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

        // ================================
        // VIEW
        // ================================

        if (subcommand === "view") {

            const config =
                getGuildConfig(
                    interaction.guild.id
                );

            const category =
                config.temporaryChannels?.categoryId
                    ? `<#${config.temporaryChannels.categoryId}>`
                    : "Not configured";

            const logs = [];

            if (config.logs) {
                for (
                    const [type, channelId]
                    of Object.entries(config.logs)
                ) {
                    if (channelId) {
                        logs.push(
                            `• **${type}** → <#${channelId}>`
                        );
                    }
                }
            }

            return interaction.reply({
                content:
                    `## ⚙️ Multi Striker\n\n` +

                    `### 🔐 Security\n` +
                    `Automatic Discord permission verification: **ON**\n\n` +

                    `### ⏱️ Temporary Channels\n` +
                    `Enabled: **${
                        config.temporaryChannels?.enabled
                            ? "YES"
                            : "NO"
                    }**\n` +
                    `Category: ${category}\n\n` +

                    `### 📋 Logs\n` +
                    (
                        logs.length
                            ? logs.join("\n")
                            : "No logs configured."
                    ),

                ephemeral: true
            });
        }
    }
};