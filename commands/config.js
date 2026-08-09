const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder
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

        // ==========================================
        // SECURITY
        // ==========================================

        .addSubcommand(sub =>
            sub
                .setName("security")
                .setDescription(
                    "Perform a complete server security audit"
                )
        )

        // ==========================================
        // LOG
        // ==========================================

        .addSubcommand(sub =>
            sub
                .setName("log")
                .setDescription("Configure a log channel")

                .addStringOption(option =>
                    option
                        .setName("type")
                        .setDescription("Type of log")
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
        // TEMPORARY CHANNELS
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
        // VIEW
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
                    "❌ This command can only be used inside a server.",
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
                    "❌ You need the **Administrator** permission to configure Multi Striker.",
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

            const guild = interaction.guild;

            try {

                // Fetch current server data
                await guild.roles.fetch();
                await guild.members.fetch();
                await guild.channels.fetch();

                const roles = [
                    ...guild.roles.cache.values()
                ].sort(
                    (a, b) =>
                        b.position - a.position
                );

                const members = [
                    ...guild.members.cache.values()
                ];

                const channels = [
                    ...guild.channels.cache.values()
                ];

                // ======================================
                // DANGEROUS PERMISSIONS
                // ======================================

                const dangerousPermissions = [
                    PermissionFlagsBits.Administrator,
                    PermissionFlagsBits.ManageGuild,
                    PermissionFlagsBits.ManageRoles,
                    PermissionFlagsBits.ManageChannels,
                    PermissionFlagsBits.BanMembers,
                    PermissionFlagsBits.KickMembers,
                    PermissionFlagsBits.ManageWebhooks,
                    PermissionFlagsBits.ModerateMembers
                ];

                // ======================================
                // ROLE ANALYSIS
                // ======================================

                const roleFindings = [];

                for (const role of roles) {

                    if (role.managed) {
                        continue;
                    }

                    const memberCount =
                        members.filter(member =>
                            member.roles.cache.has(
                                role.id
                            )
                        ).length;

                    const dangerous = [];

                    for (
                        const permission
                        of dangerousPermissions
                    ) {

                        if (
                            role.permissions.has(
                                permission
                            )
                        ) {
                            dangerous.push(
                                permission
                            );
                        }
                    }

                    if (dangerous.length > 0) {

                        roleFindings.push({
                            role,
                            memberCount,
                            dangerous
                        });
                    }
                }

                // ======================================
                // ADMINISTRATOR ANALYSIS
                // ======================================

                const administratorRoles =
                    roles.filter(role =>
                        !role.managed &&
                        role.permissions.has(
                            PermissionFlagsBits.Administrator
                        )
                    );

                const administratorMembers = [];

                for (const member of members) {

                    if (
                        member.permissions.has(
                            PermissionFlagsBits.Administrator
                        )
                    ) {
                        administratorMembers.push(
                            member
                        );
                    }
                }

                // ======================================
                // BOT HIERARCHY
                // ======================================

                const botMember =
                    guild.members.me;

                let botFinding =
                    "⚠️ Bot member information unavailable.";

                if (botMember) {

                    const botRole =
                        botMember.roles.highest;

                    const owner =
                        await guild.fetchOwner();

                    if (
                        botRole.position >=
                        owner.roles.highest.position
                    ) {
                        botFinding =
                            "⚠️ Bot role hierarchy requires review.";
                    } else {
                        botFinding =
                            "✅ Bot is below the server owner.";
                    }
                }

                // ======================================
                // @EVERYONE ANALYSIS
                // ======================================

                const everyone =
                    guild.roles.everyone;

                const everyoneDangerous = [];

                for (
                    const permission
                    of dangerousPermissions
                ) {

                    if (
                        everyone.permissions.has(
                            permission
                        )
                    ) {
                        everyoneDangerous.push(
                            permission
                        );
                    }
                }

                // ======================================
                // CHANNEL ANALYSIS
                // ======================================

                let channelOverrides = 0;

                for (const channel of channels) {

                    if (
                        !channel.permissionOverwrites
                    ) {
                        continue;
                    }

                    if (
                        channel.permissionOverwrites.cache
                            .size > 0
                    ) {
                        channelOverrides++;
                    }
                }

                // ======================================
                // BASIC SECURITY SCORE
                // ======================================

                let score = 100;

                if (
                    administratorRoles.length > 1
                ) {
                    score -= 15;
                }

                if (
                    administratorMembers.length > 3
                ) {
                    score -= 10;
                }

                if (
                    roleFindings.length > 5
                ) {
                    score -= 10;
                }

                if (
                    everyoneDangerous.length > 0
                ) {
                    score -= 30;
                }

                if (
                    channelOverrides > 20
                ) {
                    score -= 5;
                }

                score =
                    Math.max(
                        0,
                        score
                    );

                let status;

                if (score >= 90) {
                    status =
                        "🟢 EXCELLENT";
                } else if (score >= 75) {
                    status =
                        "🟢 GOOD";
                } else if (score >= 50) {
                    status =
                        "🟡 NEEDS REVIEW";
                } else {
                    status =
                        "🔴 HIGH RISK";
                }

                // ======================================
                // ROLE REPORT
                // ======================================

                let roleReport = "";

                if (
                    roleFindings.length === 0
                ) {

                    roleReport =
                        "✅ No dangerous role permissions detected.";

                } else {

                    roleReport =
                        roleFindings
                            .slice(0, 8)
                            .map(item => {

                                const permissionText =
                                    item.dangerous
                                        .map(permission =>
                                            permission
                                                .replace(
                                                    /([A-Z])/g,
                                                    " $1"
                                                )
                                                .trim()
                                        )
                                        .join(", ");

                                return (
                                    `**${item.role.name}**\n` +
                                    `Members: ${item.memberCount}\n` +
                                    `Permissions: ${permissionText}`
                                );
                            })
                            .join("\n\n");
                }

                // ======================================
                // @EVERYONE REPORT
                // ======================================

                const everyoneReport =
                    everyoneDangerous.length === 0
                        ? "✅ @everyone has no dangerous permissions."
                        : `🚨 @everyone has: ${everyoneDangerous.join(", ")}`;

                // ======================================
                // EMBED
                // ======================================

                const embed =
                    new EmbedBuilder()
                        .setTitle(
                            "🛡️ Multi Striker Security Audit"
                        )
                        .setDescription(
                            `**${status}**\n\n` +
                            `Security Score: **${score}/100**`
                        )

                        .addFields(
                            {
                                name:
                                    "👥 Administrator Access",
                                value:
                                    `Roles: **${administratorRoles.length}**\n` +
                                    `Members: **${administratorMembers.length}**`,
                                inline: true
                            },
                            {
                                name:
                                    "📁 Channel Overrides",
                                value:
                                    `${channelOverrides}`,
                                inline: true
                            },
                            {
                                name:
                                    "🤖 Bot Hierarchy",
                                value:
                                    botFinding
                            },
                            {
                                name:
                                    "🌐 @everyone",
                                value:
                                    everyoneReport
                            },
                            {
                                name:
                                    "🔐 High-Permission Roles",
                                value:
                                    roleReport
                            }
                        )

                        .setFooter({
                            text:
                                "Multi Striker Security Engine"
                        })

                        .setTimestamp();

                await interaction.editReply({
                    embeds: [embed]
                });

            } catch (error) {

                console.error(
                    "Security audit error:",
                    error
                );

                await interaction.editReply({
                    content:
                        "❌ Security audit failed. Check the bot console for details."
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
                    `✅ Temporary channels are enabled.\n\n` +
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

            const category =
                config.temporaryChannels
                    .categoryId
                    ? `<#${config.temporaryChannels.categoryId}>`
                    : "Not configured";

            const logs = [];

            for (
                const [type, channelId]
      