const {
    PermissionFlagsBits,
    ChannelType
} = require("discord.js");

const DANGEROUS_PERMISSIONS = [
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ManageWebhooks,
    PermissionFlagsBits.ModerateMembers,
    PermissionFlagsBits.ManageNicknames,
    PermissionFlagsBits.MentionEveryone
];

const PERMISSION_NAMES = {
    [PermissionFlagsBits.Administrator]: "Administrator",
    [PermissionFlagsBits.ManageGuild]: "Manage Server",
    [PermissionFlagsBits.ManageRoles]: "Manage Roles",
    [PermissionFlagsBits.ManageChannels]: "Manage Channels",
    [PermissionFlagsBits.BanMembers]: "Ban Members",
    [PermissionFlagsBits.KickMembers]: "Kick Members",
    [PermissionFlagsBits.ManageMessages]: "Manage Messages",
    [PermissionFlagsBits.ManageWebhooks]: "Manage Webhooks",
    [PermissionFlagsBits.ModerateMembers]: "Timeout Members",
    [PermissionFlagsBits.ManageNicknames]: "Manage Nicknames",
    [PermissionFlagsBits.MentionEveryone]: "Mention Everyone"
};

function getDangerousPermissions(role) {
    return DANGEROUS_PERMISSIONS
        .filter(permission =>
            role.permissions.has(permission)
        )
        .map(permission =>
            PERMISSION_NAMES[permission]
        );
}

function getRoleMemberCount(guild, role) {
    let count = 0;

    for (const member of guild.members.cache.values()) {
        if (member.roles.cache.has(role.id)) {
            count++;
        }
    }

    return count;
}

function getRoleMemberPercentage(guild, memberCount) {
    const total = guild.memberCount;

    if (!total) return 0;

    return Number(
        ((memberCount / total) * 100).toFixed(2)
    );
}

function classifyRole(role, memberCount, percentage) {

    const name = role.name.toLowerCase();

    const indicators = {
        community: [
            "member",
            "community",
            "verified",
            "user",
            "everyone",
            "guest"
        ],

        moderation: [
            "mod",
            "moderator",
            "moderation",
            "helper",
            "staff"
        ],

        administration: [
            "admin",
            "administrator",
            "owner",
            "management",
            "manager"
        ],

        developer: [
            "developer",
            "dev",
            "developer team",
            "coding",
            "programmer"
        ],

        event: [
            "event",
            "events",
            "organizer",
            "host"
        ],

        bot: [
            "bot"
        ]
    };

    const matches = {};

    for (const [type, words] of Object.entries(indicators)) {

        matches[type] = words.filter(word =>
            name.includes(word)
        );
    }

    let likelyPurpose = "unknown";
    let confidence = 0;

    for (const [type, words] of Object.entries(matches)) {

        if (words.length > confidence) {
            confidence = words.length;
            likelyPurpose = type;
        }
    }

    let distribution;

    if (percentage >= 80) {
        distribution = "very_wide";
    } else if (percentage >= 50) {
        distribution = "wide";
    } else if (percentage >= 20) {
        distribution = "moderate";
    } else if (percentage >= 5) {
        distribution = "limited";
    } else {
        distribution = "restricted";
    }

    return {
        likelyPurpose,
        confidence,
        distribution,
        memberCount,
        percentage
    };
}

function analyzeRole(guild, role) {

    if (role.managed) {
        return {
            id: role.id,
            name: role.name,
            managed: true,
            skipped: true
        };
    }

    const memberCount =
        getRoleMemberCount(guild, role);

    const percentage =
        getRoleMemberPercentage(
            guild,
            memberCount
        );

    const dangerousPermissions =
        getDangerousPermissions(role);

    const context =
        classifyRole(
            role,
            memberCount,
            percentage
        );

    let concerns = [];

    /*
     * IMPORTANT:
     *
     * Member count is contextual information.
     * It is NOT automatically a security violation.
     */

    if (
        context.likelyPurpose === "moderation" &&
        percentage >= 50 &&
        dangerousPermissions.length > 0
    ) {
        concerns.push(
            "A large percentage of the server has a role that appears to be intended for moderation."
        );
    }

    if (
        context.likelyPurpose === "community" &&
        dangerousPermissions.includes("Administrator")
    ) {
        concerns.push(
            "The role appears to be a general/community role but has Administrator privileges."
        );
    }

    if (
        context.likelyPurpose === "unknown" &&
        dangerousPermissions.length >= 3
    ) {
        concerns.push(
            "The role has several powerful permissions but its intended purpose cannot be inferred confidently."
        );
    }

    if (
        dangerousPermissions.includes("Administrator") &&
        percentage >= 50
    ) {
        concerns.push(
            "Administrator privileges are distributed to a large portion of the server."
        );
    }

    if (
        context.likelyPurpose === "moderation" &&
        percentage >= 20 &&
        dangerousPermissions.some(permission =>
            [
                "Ban Members",
                "Kick Members",
                "Timeout Members",
                "Manage Messages"
            ].includes(permission)
        )
    ) {
        concerns.push(
            "Moderation privileges are distributed unusually widely."
        );
    }

    let risk = "low";

    if (dangerousPermissions.length >= 4) {
        risk = "high";
    } else if (dangerousPermissions.length >= 2) {
        risk = "medium";
    }

    if (concerns.length >= 2) {
        risk = "high";
    }

    return {
        id: role.id,
        name: role.name,

        managed: false,

        position: role.position,

        memberCount,

        memberPercentage: percentage,

        permissions: dangerousPermissions,

        context,

        concerns,

        risk
    };
}

async function runSecurityAudit(guild) {

    await guild.roles.fetch();
    await guild.members.fetch();
    await guild.channels.fetch();

    const roles = [
        ...guild.roles.cache.values()
    ].sort(
        (a, b) =>
            b.position - a.position
    );

    const roleAnalysis = [];

    for (const role of roles) {

        const result =
            analyzeRole(
                guild,
                role
            );

        roleAnalysis.push(result);
    }

    // ==========================================
    // @EVERYONE
    // ==========================================

    const everyone =
        guild.roles.everyone;

    const everyonePermissions =
        getDangerousPermissions(
            everyone
        );

    // ==========================================
    // ADMINISTRATORS
    // ==========================================

    const administrators =
        guild.members.cache.filter(member =>
            member.permissions.has(
                PermissionFlagsBits.Administrator
            )
        );

    // ==========================================
    // CHANNEL OVERRIDES
    // ==========================================

    let channelsWithOverrides = 0;

    for (const channel of guild.channels.cache.values()) {

        if (!channel.permissionOverwrites) {
            continue;
        }

        if (
            channel.permissionOverwrites.cache
                .size > 0
        ) {
            channelsWithOverrides++;
        }
    }

    // ==========================================
    // BOT
    // ==========================================

    let bot = null;

    if (guild.members.me) {

        bot = {
            id: guild.members.me.id,

            highestRole:
                guild.members.me.roles.highest.name,

            highestRolePosition:
                guild.members.me.roles.highest.position,

            administrator:
                guild.members.me.permissions.has(
                    PermissionFlagsBits.Administrator
                ),

            permissions:
                getDangerousPermissions(
                    guild.members.me.roles.highest
                )
        };
    }

    // ==========================================
    // RISK SUMMARY
    // ==========================================

    const highRiskRoles =
        roleAnalysis.filter(
            role =>
                role.risk === "high"
        );

    const mediumRiskRoles =
        roleAnalysis.filter(
            role =>
                role.risk === "medium"
        );

    let score = 100;

    if (everyonePermissions.length > 0) {
        score -= 30;
    }

    if (administrators.size > 5) {
        score -= 15;
    } else if (administrators.size > 3) {
        score -= 10;
    }

    if (highRiskRoles.length > 0) {
        score -= Math.min(
            30,
            highRiskRoles.length * 5
        );
    }

    if (channelsWithOverrides > 20) {
        score -= 5;
    }

    score =
        Math.max(
            0,
            score
        );

    let status;

    if (score >= 90) {
        status = "EXCELLENT";
    } else if (score >= 75) {
        status = "GOOD";
    } else if (score >= 50) {
        status = "NEEDS REVIEW";
    } else {
        status = "HIGH RISK";
    }

    return {
        generatedAt:
            new Date().toISOString(),

        guild: {
            id: guild.id,
            name: guild.name,
            memberCount: guild.memberCount,
            roleCount: guild.roles.cache.size,
            channelCount: guild.channels.cache.size
        },

        score,
        status,

        roles: roleAnalysis,

        administrators: {
            count: administrators.size,
            members: administrators.map(
                member => ({
                    id: member.id,
                    name: member.user.tag
                })
            )
        },

        everyone: {
            dangerousPermissions:
                everyonePermissions
        },

        channels: {
            withPermissionOverrides:
                channelsWithOverrides
        },

        bot,

        summary: {
            highRiskRoles:
                highRiskRoles.length,

            mediumRiskRoles:
                mediumRiskRoles.length,

            lowRiskRoles:
                roleAnalysis.filter(
                    role =>
                        role.risk === "low"
                ).length
        }
    };
}

module.exports = {
    runSecurityAudit,
    analyzeRole,
    classifyRole,
    getDangerousPermissions
};