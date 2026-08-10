const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType
} = require("discord.js");

const {
    getGuildConfig,
    updateGuildConfig
} = require("../config/manager");

const {
    runSecurityAudit
} = require("../core/securityAudit");

module.exports = {

    data: new SlashCommandBuilder()
        .setName("config")
        .setDescription("Configure Multi Striker")

        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        )

        // ==========================================
        // /config security
        // ==========================================

        .addSubcommand(sub =>
            sub
                .setName("security")
                .setDescription(
                    "Run a complete server security audit"
                )
        )

        // ==========================================
        // /config log
        // ==========================================

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
                            "Channel where logs will be sent"
                        )
                        .addChannelTypes(
                            ChannelType.GuildText
                        )
                        .setRequired(true)
                )
        )

        // ==========================================
        // /config temporary
        // ==========================================

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
                            "Category for temporary channels"
                        )
                        .addChannelTypes(
                            ChannelType.GuildCategory
                        )
                        .setRequired(true)
                )
        )

        // ==========================================
        // /config view
        // ==========================================

        .addSubcommand(sub =>
            sub
                .setName("view")
                .setDescription(
                    "View Multi Striker configuration"
                )
        ),

    async execute(interaction) {

        // ==========================================
        // SERVER CHECK
        // ==========================================

        if (!interaction.guild) {
            return interaction.reply({
                content:
                    "❌ This command can only be used in a server.",
                ephemeral: true
            });
        }

        // ==========================================
        // ADMIN CHECK
        // ==========================================

        if (
            !interaction.memberPermissions.has(
                PermissionFlagsBits.Administrator
            )
        ) {
            return interaction.reply({
                content:
                    "❌ You need the **Administrator** permission.",
                ephemeral: true
            });
        }

        const subcommand =
            interaction.options.getSubcommand();

        // ==========================================
        // SECURITY AUDIT
        // ==========================================

        if (subcommand === "security") {

            await interaction.deferReply({
                ephemeral: true
            });

            try {

                const audit =
                    await runSecurityAudit(
                        interaction.guild
                    );

                const highRisk =
                    audit.roles.filter(
                        role =>
                            role.risk === "high"
                    );

                const mediumRisk =
                    audit.roles.filter(
                        role =>
                            role.risk === "medium"
                    );

                const lowRisk =
                    audit.roles.filter(
                        role =>
                            role.risk === "low"
                    );

                const roleList =
                    audit.roles
                        .filter(
                            role =>
                                !role.managed
                        )
                        .slice(0, 15)
                        .map(role => {

                            const riskIcon =
                                role.risk === "high"
                                    ? "🔴"
                                    : role.risk === "medium"
                                        ? "🟡"
                                        : "🟢";

                            const permissions =
                                role.permissions.length
                                    ? role.permissions.join(", ")
                                    : "No dangerous permissions";

                            return (
                                `${riskIcon} **${role.name}**\n` +
                                `Members: ${role.memberCount} ` +
                                `(${role.memberPercentage}%)\n` +
                                `Likely purpose: ${role.context.likelyPurpose}\n` +
                                `Permissions: ${permissions}`
                            );
                        })
                        .join("\n\n");

                const everyone =
                    audit.everyone
                        .dangerousPermissions
                        .length
                        ? audit.everyone
                            .dangerousPermissions
                            .join(", ")
                        : "None";

                const botStatus =
                    audit.bot
                        ? (
                            `Highest role: **${audit.bot.highestRole}**\n` +
                            `Administrator: **${
                                audit.bot.administrator
                                    ? "YES"
                                    : "NO"
                            }**`
                        )
                        : "Bot information unavailable.";

                const report =
                    `🛡️ **Multi Striker Security Audit**\n\n` +

                    `### 📊 Overall Security\n` +
                    `**Score:** ${audit.score}/100\n` +
                    `**Status:** ${audit.status}\n\n` +

                    `### 🏠 Server\n` +
                    `Members: **${audit.guild.memberCount}**\n` +
                    `Roles: **${audit.guild.roleCount}**\n` +
                    `Channels: **${audit.guild.channelCount}**\n\n` +

                    `### 🎭 Role Risk\n` +
                    `🔴 High: **${highRisk.length}**\n` +
                    `🟡 Medium: **${mediumRisk.length}**\n` +
                    `🟢 Low: **${lowRisk.length}**\n\n` +

                    `### 👑 Administrator Access\n` +
                    `Members with Administrator: **${audit.administrators.count}**\n\n` +

                    `### 🌐 @everyone\n` +
                    `Dangerous permissions: **${everyone}**\n\n` +

                    `### 🤖 Bot\n` +
                    `${botStatus}\n\n` +

                    `### 📁 Channel Permissions\n` +
                    `Channels with permission overrides: **${audit.channels.withPermissionOverrides}**\n\n` +

                    `### 🔐 Role Analysis\n` +
                    `${roleList || "No roles found."}`;

                await interaction.editReply({
                    content: report
                });

            } catch (error) {

                console.error(
                    "❌ Security audit failed:",
                    error
                );

                await interaction.editReply({
                    content:
                        "❌ Security audit failed.\n\n" +
                        "Check the bot console for the exact error."
                });
            }

            return;
        }

        // ==========================================
        // LOG CONFIGURATION
        // ==========================================

        if (subcommand === "log") {

            const type =
                interaction.options.getString(
                    "type"
                );

            const channel =
                interaction.options.getChannel(
                    "channel"
                );

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
                    `✅ **${type}** logs will now be sent to ${channel}.`,
                ephemeral: true
            });
        }

        // ==========================================
        // TEMPORARY CHANNEL CONFIGURATION
        // ==========================================

        if (subcommand === "temporary") {

            const category =
                interaction.options.getChannel(
                    "category"
                );

            updateGuildConfig(
                interaction.guild.id,
                {
                    temporaryChannels: {
                        categoryId:
                            category.id,

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

        // ==========================================
        // VIEW CONFIGURATION
        // ==========================================

        if (subcommand === "view") {

            const config =
                getGuildConfig(
                    interaction.guild.id
                );

            const temporary =
                config.temporaryChannels || {};

            const category =
                temporary.categoryId
                    ? `<#${temporary.categoryId}>`
                    : "Not configured";

            const logs = [];

            if (config.logs) {

                for (
                    const [type, channelId]
                    of Object.entries(
                        config.logs
                    )
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
                    `## ⚙️ Multi Striker Configuration\n\n` +

                    `### 🔐 Security\n` +
                    `Security auditing: **ON**\n` +
                    `Permission verification: **ON**\n\n` +

                    `### 🎙️ Temporary Channels\n` +
                    `Enabled: **${
                        temporary.enabled
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