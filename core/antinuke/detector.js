const { getGuildConfig } = require("../../config/manager");
const tracker = require("./tracker");
const { isTrusted } = require("../security/trust");
const { containMember, reportContainment } = require("./actions");

const ACTION_TO_THRESHOLD = {
    channelDelete: "channelDelete",
    channelCreate: "channelCreate",
    roleDelete: "roleDelete",
    roleCreate: "roleCreate",
    roleUpdate: "roleUpdate",
    ban: "ban",
    kick: "kick",
    webhookCreate: "webhookCreate"
};

const lastTriggered = new Map();

async function processSecurityAction(guild, executorId, actionType, targetId) {
    const config = getGuildConfig(guild.id);
    if (!config.security.enabled || !config.antinuke.enabled) return;
    if (!executorId || await isTrusted(guild, executorId)) return;

    const thresholdKey = ACTION_TO_THRESHOLD[actionType];
    const threshold = config.antinuke.thresholds[thresholdKey];
    if (!threshold) return;

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
    await reportContainment(guild, executorId, actionType, count, result);

    console.warn("ANTI-NUKE:", { guild: guild.id, executorId, actionType, targetId, count, result });
}

module.exports = { processSecurityAction };
