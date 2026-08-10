const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require("discord.js");

const {
    getGuildConfig,
    updateGuildConfig
} = require("../config/manager");

const {
    runSecurityAudit
} = require("../core/securityAudit");


module.exports = {

    // =========================================================
    // COMMAND DEFINITION
    // =========================================================

    data: new SlashCommandBuilder()

        .setName("config")
        .setDescription("Configure Multi Striker")

        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        )


        // =====================================================
        // /config security
        // =====================================================

        .addSubcommand(sub =>
            sub
                .setName("security")
                .setDescription(
                    "Run a complete server security audit"
                )
        )


        // =====================================================
        // /config log
        // =====================================================

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
                            "Channel where these logs will be sent"
                        )

                        .addChannelTypes(
                            ChannelType.GuildText
                        )

                        .setRequired(true)
                )
        )


        // =====================================================
        // /config temporary
        // =====================================================

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


        // =====================================================
        // /config view
        // =====================================================

        .addSubcommand(sub =>
            sub
                .setName("view")
                .setDescription(
                    "View Multi Striker configuration"
                )
        ),


    // =========================================================
    // EXECUTE
    // =========================================================

    async execute(interaction) {

        // =====================================================
        // SERVER CHECK
        // =====================================================

        if (!interaction.guild) {

            return interaction.reply({
                content:
                    "❌ This command can only be used inside a server.",

                flags:
                    MessageFlags.Ephemeral
            });
        }


        // =====================================================
        // ADMIN CHECK
        // =====================================================

        if (
            !interaction.memberPermissions.has(
                PermissionFlagsBits.Administrator
            )
        ) {

            return interaction.reply({
                content:
                    "❌ You need the **Administrator** permission to use this command.",

                flags:
                    MessageFlags.Ephemeral
            });
        }


        const subcommand =
            interaction.options.getSubcommand();


        // =====================================================
        // SECURITY AUDIT
        // =====================================================

        if (subcommand === "security") {

            await interaction.deferReply({
                flags:
                    MessageFlags.Ephemeral
            });


            try {

                // -------------------------------------------------
                // RUN SECURITY ENGINE
                // -------------------------------------------------

                const audit =
                    await runSecurityAudit(
                        interaction.guild
                    );


                // -------------------------------------------------
                // SAFE DEFAULTS
                // -------------------------------------------------

                const roles =
                    Array.isArray(audit.roles)
                        ? audit.roles.filter(
                            role =>
                                !role.managed
                        )
                        : [];


                const highRisk =
                    roles.filter(
                        role =>
                            role.risk === "high"
                    );


                const mediumRisk =
                    roles.filter(
                        role =>
                            role.risk === "medium"
                    );


                const lowRisk =
                    roles.filter(
                        role =>
                            role.risk === "low"
                    );


                // -------------------------------------------------
                // ROLE PAGINATION
                //
                // Page 0 = Overview
                // Page 1 = Global Security
                // Page 2+ = Roles
                // -------------------------------------------------

                const rolesPerPage = 5;


                const rolePageCount =
                    Math.max(
                        1,
                        Math.ceil(
                            roles.length /
                            rolesPerPage
                        )
                    );


                const lastPage =
                    1 + rolePageCount;


                let currentPage = 0;


                // =================================================
                // EMBED BUILDER
                // =================================================

                function createEmbed(page) {

                    // =================================================
                    // PAGE 0 — OVERVIEW
                    // =================================================

                    if (page === 0) {

                        const score =
                            Number(
                                audit.score ?? 0
                            );


                        let statusIcon =
                            "🔴";


                        if (score >= 90) {

                            statusIcon =
                                "🟢";

                        } else if (score >= 75) {

                            statusIcon =
                                "🟡";

                        } else if (score >= 50) {

                            statusIcon =
                                "🟠";
                        }


                        const status =
                            audit.status ||
                            "Unknown";


                        const guild =
                            audit.guild ||
                            {};


                        const administrators =
                            audit.administrators ||
                            {};


                        const channels =
                            audit.channels ||
                            {};


                        return new EmbedBuilder()

                            .setTitle(
                                "🛡️ Multi Striker Security Audit"
                            )

                            .setDescription(
                                `${statusIcon} **${status}**\n\n` +
                                "Multi Striker analyzed the server's security configuration, permissions, roles and channels."
                            )

                            .addFields(

                                {
                                    name:
                                        "📊 Security Score",

                                    value:
                                        `**${score}/100**`,

                                    inline:
                                        true
                                },

                                {
                                    name:
                                        "👥 Members",

                                    value:
                                        `${guild.memberCount ?? interaction.guild.memberCount}`,

                                    inline:
                                        true
                                },

                                {
                                    name:
                                        "🎭 Roles",

                                    value:
                                        `${guild.roleCount ?? interaction.guild.roles.cache.size}`,

                                    inline:
                                        true
                                },

                                {
                                    name:
                                        "📁 Channels",

                                    value:
                                        `${guild.channelCount ?? interaction.guild.channels.cache.size}`,

                                    inline:
                                        true
                                },

                                {
                                    name:
                                        "🔴 High Risk",

                                    value:
                                        `${highRisk.length}`,

                                    inline:
                                        true
                                },

                                {
                                    name:
                                        "🟡 Medium Risk",

                                    value:
                                        `${mediumRisk.length}`,

                                    inline:
                                        true
                                },

                                {
                                    name:
                                        "🟢 Low Risk",

                                    value:
                                        `${lowRisk.length}`,

                                    inline:
                                        true
                                },

                                {
                                    name:
                                        "👑 Administrators",

                                    value:
                                        `${administrators.count ?? 0}`,

                                    inline:
                                        true
                                },

                                {
                                    name:
                                        "📁 Permission Overrides",

                                    value:
                                        `${channels.withPermissionOverrides ?? 0}`,

                                    inline:
                                        true
                                }
                            )

                            .setFooter({
                                text:
                                    "Multi Striker • Security Dashboard"
                            })

                            .setTimestamp();
                    }


                    // =================================================
                    // PAGE 1 — GLOBAL SECURITY
                    // =================================================

                    if (page === 1) {

                        const everyone =
                            audit.everyone ||
                            {};


                        const dangerous =
                            Array.isArray(
                                everyone.dangerousPermissions
                            )
                                ? everyone.dangerousPermissions
                                : [];


                        const everyoneText =
                            dangerous.length > 0
                                ? dangerous
                                    .slice(0, 15)
                                    .map(
                                        permission =>
                                            `• \`${permission}\``
                                    )
                                    .join("\n")
                                : "🟢 None detected.";


                        const administrators =
                            audit.administrators ||
                            {};


                        const adminMembers =
                            Array.isArray(
                                administrators.members
                            )
                                ? administrators.members
                                : [];


                        const adminText =
                            adminMembers.length > 0

                                ? adminMembers
                                    .slice(0, 15)
                                    .map(
                                        member =>
                                            `• ${member.name || member.username || member.id}`
                                    )
                                    .join("\n")

                                : "🟢 No administrator accounts reported.";


                        const bot =
                            audit.bot ||
                            {};


                        const botText =
                            bot
                                ? (
                                    `**Highest Role:** ${bot.highestRole || "Unknown"}\n` +
                                    `**Administrator:** ${
                                        bot.administrator
                                            ? "⚠️ YES"
                                            : "🟢 NO"
                                    }`
                                )
                                : "Bot information unavailable.";


                        return new EmbedBuilder()

                            .setTitle(
                                "🔐 Global Security"
                            )

                            .setDescription(
                                "Server-wide permission and administrative security."
                            )

                            .addFields(

                                {
                                    name:
                                        "🌐 @everyone Dangerous Permissions",

                                    value:
                                        everyoneText
                                },

                                {
                                    name:
                                        "👑 Administrator Accounts",

                                    value:
                                        adminText
                                },

                                {
                                    name:
                                        "🤖 Multi Striker",

                                    value:
                                        botText
                                }
                            )

                            .setFooter({
                                text:
                                    "Multi Striker • Global Security"
                            })

                            .setTimestamp();
                    }


                    // =================================================
                    // PAGE 2+ — ROLE ANALYSIS
                    // =================================================

                    const rolePage =
                        page - 2;


                    const start =
                        rolePage *
                        rolesPerPage;


                    const pageRoles =
                        roles.slice(
                            start,
                            start + rolesPerPage
                        );


                    const embed =
                        new EmbedBuilder()

                            .setTitle(
                                `🎭 Role Analysis • Page ${rolePage + 1}/${rolePageCount}`
                            )

                            .setDescription(
                                "Every normal server role is analyzed. Member count alone is not treated as a security violation; it is used as contextual information."
                            )

                            .setFooter({
                                text:
                                    "Multi Striker • Contextual Role Analysis"
                            });


                    if (pageRoles.length === 0) {

                        embed.addFields({
                            name:
                                "No roles",
           