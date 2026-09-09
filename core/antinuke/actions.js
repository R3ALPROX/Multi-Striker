const { PermissionFlagsBits } = require("discord.js");
const { securityEmbed, sendLog } = require("../security/logger");
const https = require("node:https");

const ownerAlertCooldown = new Map();
const reportCooldown = new Map();

function postJson(urlString, payload) {
    return new Promise((resolve, reject) => {
        let url;
        try { url = new URL(urlString); } catch { reject(new Error("Invalid report URL")); return; }
        if (url.protocol !== "https:") { reject(new Error("Report URL must use HTTPS")); return; }
        const body = JSON.stringify(payload);
        const request = https.request(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
            timeout: 5000
        }, response => {
            response.resume();
            response.on("end", () => {
                if (response.statusCode >= 200 && response.statusCode < 300) resolve({ ok: true, status: response.statusCode });
                else reject(new Error(`Report endpoint returned HTTP ${response.statusCode}`));
            });
        });
        request.on("timeout", () => request.destroy(new Error("Report endpoint timed out")));
        request.on("error", reject);
        request.write(body);
        request.end();
    });
}

async function notifyOwnerOfDestruction(guild, executorId, eventName, count, details = {}) {
    const key = guild.id;
    const now = Date.now();
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

function buildIncidentReport(guild, executorId, eventName, count, result = {}, details = {}) {
    return {
        schema: "multi-striker/security-incident/v1",
        generatedAt: new Date().toISOString(),
        guild: { id: guild.id, name: guild.name },
        actor: { id: executorId },
        incident: {
            type: "destructive-discord-action",
            action: eventName,
            count,
            severity: details.severity || "CRITICAL",
            trustedActor: !!details.trustedActor
        },
        containment: {
            action: result.action || null,
            ok: !!result.ok,
            message: result.message || null,
            quarantine: details.quarantine || null
        },
        evidence: details.evidence || [],
        note: "This report contains observations made by Multi Striker. It is not a claim of intent or guilt beyond the observed behavior."
    };
}

async function reportSecurityIncident(guild, executorId, eventName, count, result = {}, details = {}) {
    const key = `${guild.id}:${executorId}`;
    const now = Date.now();
    if (now - (reportCooldown.get(key) || 0) < 60000) return { ok: false, rateLimited: true };
    reportCooldown.set(key, now);

    const report = buildIncidentReport(guild, executorId, eventName, count, result, details);
    await sendLog(guild, "security", securityEmbed(
        "SECURITY INCIDENT REPORT",
        "Multi Striker recorded a structured destructive-action incident.",
        [
            { name: "Actor", value: `<@${executorId}>`, inline: true },
            { name: "Action", value: eventName, inline: true },
            { name: "Count", value: String(count), inline: true },
            { name: "Severity", value: String(report.incident.severity), inline: true },
            { name: "Containment", value: result.ok ? String(result.action || "completed") : `Failed: ${result.message || "unknown"}`, inline: false }
        ]
    )).catch(() => {});

    // Discord does not expose a general public API for bots to submit Trust & Safety
    // reports on behalf of users. Never pretend this endpoint is an official Discord
    // reporting channel. If the developer configures an HTTPS incident collector,
    // send the evidence there for human review and onward reporting.
    const endpoint = process.env.MULTI_STRIKER_INCIDENT_WEBHOOK_URL;
    if (!endpoint) return { ok: true, storedInServerLog: true, forwarded: false, report };

    try {
        await postJson(endpoint, report);
        return { ok: true, storedInServerLog: true, forwarded: true, report };
    } catch (error) {
        console.warn("Multi Striker incident forwarding failed:", error.message);
        return { ok: false, storedInServerLog: true, forwarded: false, report, message: error.message };
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

        const removable = member.roles.cache.filter(role =>
            role.id !== guild.id && !role.managed && role.editable
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

module.exports = { containMember, reportContainment, notifyOwnerOfDestruction, reportSecurityIncident, buildIncidentReport };
