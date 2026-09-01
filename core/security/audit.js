const { PermissionFlagsBits } = require("discord.js");

const DANGEROUS = [
    "Administrator",
    "ManageGuild",
    "ManageRoles",
    "ManageChannels",
    "BanMembers",
    "KickMembers",
    "ManageWebhooks",
    "MentionEveryone"
];

function permissionNames(permissions) {
    return DANGEROUS.filter(name => permissions.has(PermissionFlagsBits[name]));
}

function roleRisk(role, memberCount) {
    const dangerous = permissionNames(role.permissions);
    const hasAdmin = role.permissions.has(PermissionFlagsBits.Administrator);
    let score = dangerous.length * 8 + (hasAdmin ? 30 : 0);

    // Context: powerful roles held by many members deserve attention,
    // but are not automatically classified as malicious.
    if (memberCount >= 10 && dangerous.length >= 2) score += 15;
    else if (memberCount >= 5 && dangerous.length >= 1) score += 8;

    return {
        score: Math.min(100, score),
        dangerous,
        level: score >= 45 ? "high" : score >= 20 ? "medium" : "low"
    };
}

async function runSecurityAudit(guild) {
    const roles = [...guild.roles.cache.values()]
        .filter(role => !role.managed && role.id !== guild.id)
        .sort((a, b) => b.position - a.position);

    const members = await guild.members.fetch();
    const roleResults = roles.map(role => {
        const holders = members.filter(member => member.roles.cache.has(role.id));
        const risk = roleRisk(role, holders.size);
        return {
            id: role.id,
            name: role.name,
            memberCount: holders.size,
            ...risk
        };
    });

    const everyone = guild.roles.everyone;
    const everyoneDangerous = permissionNames(everyone.permissions);

    const adminMembers = members.filter(member =>
        member.permissions.has(PermissionFlagsBits.Administrator)
    );

    const riskyRoles = roleResults.filter(role => role.level === "high").length;
    const mediumRoles = roleResults.filter(role => role.level === "medium").length;

    let score = 100;
    score -= everyoneDangerous.length * 15;
    score -= Math.min(25, riskyRoles * 4);
    score -= Math.min(15, mediumRoles * 2);
    score -= adminMembers.size > 8 ? 10 : 0;

    const botMember = guild.members.me;
    const botPermissions = botMember ? permissionNames(botMember.permissions) : [];

    const status = score >= 85 ? "Strong" : score >= 65 ? "Needs attention" : "High risk";

    return {
        score: Math.max(0, score),
        status,
        guild: {
            memberCount: guild.memberCount,
            roleCount: roles.length,
            channelCount: guild.channels.cache.size
        },
        everyone: { dangerousPermissions: everyoneDangerous },
        administrators: {
            count: adminMembers.size,
            members: adminMembers.map(member => ({
                id: member.id,
                name: member.user.tag
            }))
        },
        bot: {
            administrator: botMember?.permissions.has(PermissionFlagsBits.Administrator) || false,
            dangerousPermissions: botPermissions
        },
        roles: roleResults
    };
}

module.exports = { runSecurityAudit, DANGEROUS };
