const { PermissionFlagsBits } = require("discord.js");
const { securityEmbed, sendLog } = require("../security/logger");

const ownerAlertCooldown = new Map();

async function notifyOwnerOfDestruction(guild, executorId, eventName, count, details = {}) {
    const key = guild.id;
    const now = Date.now();
    // Avoid DM-spamming the owner during a sustained attack while still allowing
    // a fresh alert after the incident has been active for a while.
    if (now - (ownerAlertCooldown.get(key) || 0) < 30000) return { ok: false, rateLimited: true };
    ownerAlertCooldown.set(key, now);

    const owner = await guild.fetchOwner().catch(() => null);
    if (!owner?.user) return { ok: false, message: "Server owner could not be fetched." };

    const severity = String(details.severity || "CRITICAL").toUpperCase();
    const containment = String(details.containment || "Automatic containment is being attempted.");
    const quarantine = details.quarantine ? `\nQuarantine: ${details.quarantine}` : "";
    const trusted = details.trustedActor ? "\nImportant: this actor was previously trusted/verified, but destructive behavior overrides trust." : "";

    const message = [
        `🚨 **MULTI STRIKER SECURITY ALERT — ${severity}**`,
        `Your server **${guild.name}** is under a destructive-action attack.`,
        `Attacking actor: <@${executorId}>`,
        `Detected action: **${eventName}**`,
        `Detected count: **${count}**`,
        `Containment: **${containment}**${quarantine}${trusted}`,
        "",
        "Multi Striker is monitoring the attack and attempting automatic containment. Check the server security logs immediately."
    ].join("\n");

    try {
        await owner.user.send(message);
        return { ok: true };
    } catch (error) {
        console.warn("Could not DM server owner security alert:", { guildId: guild.id, ownerId: owner.id, error: error.message });
        return { ok: false, message: "Owner DM failed (DMs may be disabled)." };
    }
}

async function containMember(guild, userId, reason) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return { ok: false, message: "Member could not be fetched." };
    if (userId === guild.ownerId) return { ok: false, message: "Server owner is protected." };
    if (!member.moderatable && !member.manageable && !member.bannable) {
        return { ok: false, message: "Bot hierarchy cannot act on this member." };
    }

    const { getGuildConfig } = require("../../config/manager");
    const config = getGuildConfig(guild.id);
    const action = config.security.action;

    try {
        if (action === "ban") {
            if (!member.bannable) return { ok: false, message: "Member is not bannable." };
            await member.ban({ reason });
            return { ok: true, action: "banned" };
        }

        if (action === "timeout") {
            if (!member.moderatable) return { ok: false, message: "Member is not moderatable." };
            await member.timeout(60 * 60 * 1000, reason);
            return { ok: true, action: "timed out for 1 hour" };
        }

        // Default containment: remove manageable roles, then timeout if possible.
        const removable = member.roles.cache.filter(role =>
            role.id !== guild.id &&
            !role.managed &&
            role.editable
        );

        if (removable.size) await member.roles.remove(removable, reason);
        if (member.moderatable) await member.timeout(60 * 60 * 1000, reason);

        return {
            ok: true,
            action: `roles removed (${removable.size}) and timed out where permitted`
        };
    } catch (error) {
        return { ok: false, message: error.message };
    }
}

async function reportContainment(guild, executorId, eventName, count, result) {
    await sendLog(guild, "security", securityEmbed(
        "ANTI-NUKE TRIGGERED",
        "A destructive-action threshold was exceeded.",
        [
            { name: "Executor", value: `<@${executorId}>`, inline: true },
            { name: "Action", value: eventName, inline: true },
            { name: "Detected count", value: String(count), inline: true },
            { name: "Containment", value: result.ok ? result.action : `Failed: ${result.message}` }
        ]
    ));
}

module.exports = { containMember, reportContainment, notifyOwnerOfDestruction };
