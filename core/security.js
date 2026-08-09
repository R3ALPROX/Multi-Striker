const {
    PermissionFlagsBits
} = require("discord.js");

/**
 * Multi Striker Security Core
 *
 * All administrative commands should use these checks.
 * Security decisions are made by this module, NOT by the AI.
 */

// Dangerous actions that require BOTH:
// 1. The corresponding Discord permission
// 2. The configured Multi Striker security role
const DANGEROUS_ACTIONS = {
    kick_member: PermissionFlagsBits.KickMembers,
    ban_member: PermissionFlagsBits.BanMembers,
    remove_role: PermissionFlagsBits.ManageRoles,
    delete_channel: PermissionFlagsBits.ManageChannels
};

// --------------------------------------------------
// Basic guild check
// --------------------------------------------------

function isGuildInteraction(interaction) {
    return Boolean(interaction.guild && interaction.guildId);
}

// --------------------------------------------------
// Server owner check
// --------------------------------------------------

function isServerOwner(interaction) {
    if (!isGuildInteraction(interaction)) return false;

    return interaction.user.id === interaction.guild.ownerId;
}

// --------------------------------------------------
// Discord permission check
// --------------------------------------------------

function hasPermission(interaction, permission) {
    if (!isGuildInteraction(interaction)) return false;

    return interaction.memberPermissions?.has(permission) ?? false;
}

// --------------------------------------------------
// Bot hierarchy check
// --------------------------------------------------

function canBotManageMember(interaction, member) {
    if (!interaction.guild || !member) return false;

    const botMember = interaction.guild.members.me;

    if (!botMember) return false;

    // Never allow the bot to act on the server owner.
    if (member.id === interaction.guild.ownerId) {
        return false;
    }

    // Bot cannot manage members equal to or above its highest role.
    return member.roles.highest.position < botMember.roles.highest.position;
}

// --------------------------------------------------
// Executor hierarchy check
// --------------------------------------------------

function canExecutorManageMember(interaction, member) {
    if (!interaction.member || !member) return false;

    // Server owner can manage members subject to Discord's actual API rules.
    if (interaction.user.id === interaction.guild.ownerId) {
        return true;
    }

    return member.roles.highest.position <
        interaction.member.roles.highest.position;
}

// --------------------------------------------------
// Role hierarchy check
// --------------------------------------------------

function canBotManageRole(interaction, role) {
    if (!interaction.guild || !role) return false;

    const botMember = interaction.guild.members.me;

    if (!botMember) return false;

    // @everyone can never be managed.
    if (role.id === interaction.guild.id) {
        return false;
    }

    return role.position < botMember.roles.highest.position;
}

// --------------------------------------------------
// Configured security-role check
// --------------------------------------------------

function hasSecurityRole(interaction, securityRoleId) {
    if (!securityRoleId || !interaction.member) {
        return false;
    }

    return interaction.member.roles.cache.has(securityRoleId);
}

// --------------------------------------------------
// Dangerous-action authorization
// --------------------------------------------------

function authorizeDangerousAction(
    interaction,
    action,
    securityRoleId
) {
    if (!isGuildInteraction(interaction)) {
        return {
            allowed: false,
            reason: "This action can only be used inside a server."
        };
    }

    const requiredPermission = DANGEROUS_ACTIONS[action];

    if (!requiredPermission) {
        return {
            allowed: false,
            reason: "Unknown dangerous action."
        };
    }

    // The user MUST have the actual Discord permission.
    if (!hasPermission(interaction, requiredPermission)) {
        return {
            allowed: false,
            reason: "You do not have the required Discord permission."
        };
    }

    // The user MUST also have the configured Multi Striker role.
    if (!hasSecurityRole(interaction, securityRoleId)) {
        return {
            allowed: false,
            reason: "You do not have the configured Multi Striker security role."
        };
    }

    return {
        allowed: true,
        reason: null
    };
}

// --------------------------------------------------
// Owner-only authorization
// --------------------------------------------------

function authorizeOwner(interaction) {
    if (!isServerOwner(interaction)) {
        return {
            allowed: false,
            reason: "Only the server owner can use this feature."
        };
    }

    return {
        allowed: true,
        reason: null
    };
}

// --------------------------------------------------
// AI permission boundary
// --------------------------------------------------

function isAIActionAllowed(action) {

    // AI is intentionally extremely restricted.
    // It may ONLY perform a one-minute timeout.
    if (action === "timeout_1m") {
        return true;
    }

    return false;
}

module.exports = {
    DANGEROUS_ACTIONS,
    isGuildInteraction,
    isServerOwner,
    hasPermission,
    canBotManageMember,
    canExecutorManageMember,
    canBotManageRole,
    hasSecurityRole,
    authorizeDangerousAction,
    authorizeOwner,
    isAIActionAllowed
};