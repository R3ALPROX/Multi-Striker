const { getGuildConfig } = require("../../config/manager");
const tracker = require("./tracker");
const { isTrusted } = require("../security/trust");
const { containMember, reportContainment } = require("./actions");
const { quarantineMember } = require("../quarantine/manager");
const { triggerPanic } = require("../panic/manager");
const { recent } = require("../intelligence/memory");
const { recordAndAssess } = require("../intelligence/slowAttack");
const { correlate } = require("../intelligence/correlation");
const { containVector } = require("./vectorContainment");

const ACTION_TO_THRESHOLD = {
    channelDelete: "channelDelete",
    channelCreate: "channelCreate",
    roleDelete: "roleDelete",
    roleCreate: "roleCreate",
    roleUpdate: "roleUpdate",
    ban: "ban",
    kick: "kick",
    webhookCreate: "webhookCreate",
    dangerousPermission: "dangerousPermission",
    permissionOverwrite: "permissionOverwrite",
    integration: "integration"
};

const lastTriggered = new Map();

async function processSecurityAction(guild, executorId, actionType, targetId) {
    const config = getGuildConfig(guild.id);
    if (!config.security.enabled || !config.antinuke.enabled) return;
    if (!executorId || await isTrusted(guild, executorId)) return;

    const slow = await recordAndAssess(guild.id, { executorId, actionType, targetId });
    const correlation = correlate(guild.id);

    const thresholdKey = ACTION_TO_THRESHOLD[actionType];
    const threshold = config.antinuke.thresholds[thresholdKey];
    if (!threshold) {
        if (slow.risk >= 70 || correlation.coordinated) {
            await containVector(guild, executorId, "Cross-vector attack correlation", { critical: slow.risk >= 80 || correlation.coordinated, actionType });
        }
        return;
    }

    const windowMs = config.antinuke.windowSeconds * 1000;
    const key = `${guild.id}:${executorId}:${actionType}`;
    const count = tracker.add(key, windowMs);

    if (count < threshold) return;

    const triggerKey = `${guild.id}:${executorId}`;
    const now = Date.now();
    const cooldownMs = config.security.cooldownSeconds * 1000;
    if (now - (lastTriggered.get(triggerKey) || 0) < cooldownMs) return;
    lastTriggered.set(triggerKey, now);

    const reason = `Multi Striker anti-nuke: ${count} ${actionType} actions within ${config.antinuke.windowSeconds}s`;
    const result = await containMember(guild, executorId, reason);
    const quarantine = await quarantineMember(guild, executorId, reason).catch(()=>({ok:false}));
    const recentDestructive = recent(guild.id, config.antinuke.windowSeconds * 1000).filter(e => e.type === "bot_action" && e.executorId === executorId).length;
    if (count >= Math.max(threshold * 2, config.antinuke.panicThreshold || 3) || recentDestructive >= 5 || slow.risk >= 80 || correlation.coordinated) {
        await triggerPanic(guild, "Repeated destructive activity", { executorId, actionType, count });
    }
    await reportContainment(guild, executorId, actionType, count, { ...result, quarantine });

    console.warn("ANTI-NUKE:", { guild: guild.id, executorId, actionType, targetId, count, result });
}

module.exports = { processSecurityAction };
