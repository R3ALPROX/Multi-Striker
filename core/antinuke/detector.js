const { getGuildConfig } = require("../../config/manager");
const tracker = require("./tracker");
const { isTrusted } = require("../security/trust");
const { containMember, reportContainment, notifyOwnerOfDestruction } = require("./actions");
const { quarantineMember } = require("../quarantine/manager");
const { triggerPanic } = require("../panic/manager");
const { recent } = require("../intelligence/memory");
const { recordAndAssess } = require("../intelligence/slowAttack");
const { correlate } = require("../intelligence/correlation");
const { containVector } = require("./vectorContainment");
const { runSecurityPipeline } = require("../ai/pipeline");
const aiSupervisor = require("../ai/supervisor");

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
    if (!executorId) return;

    // Trust is only a baseline signal. It must NEVER create an immunity bypass
    // for destructive behavior. A previously verified/trusted bot is monitored
    // exactly like any other actor once it starts destructive activity.
    const trustedActor = await isTrusted(guild, executorId);

    const slow = await recordAndAssess(guild.id, { executorId, actionType, targetId });
    const correlation = correlate(guild.id);

    const thresholdKey = ACTION_TO_THRESHOLD[actionType];
    const threshold = config.antinuke.thresholds[thresholdKey];
    if (!threshold) {
        if (slow.risk >= 70 || correlation.coordinated) {
            await notifyOwnerOfDestruction(guild, executorId, actionType, 1, {
                severity: "HIGH",
                containment: "Cross-vector containment requested"
            });
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

    const panicRecommended =
        count >= Math.max(threshold * 2, config.antinuke.panicThreshold || 3) ||
        recent(guild.id, config.antinuke.windowSeconds * 1000).filter(e => e.type === "bot_action" && e.executorId === executorId).length >= 5 ||
        slow.risk >= 80 || correlation.coordinated;

    const reason = `Multi Striker anti-nuke: ${count} ${actionType} actions within ${config.antinuke.windowSeconds}s`;
    const pipeline = await runSecurityPipeline({
        guildId: guild.id,
        executorId,
        actionType,
        targetId,
        count,
        threshold,
        massActions: count >= threshold,
        permissionEscalation: actionType === "dangerousPermission" || actionType === "permissionOverwrite",
        targetedSecurityBot: false,
        raidBurst: correlation.coordinated,
        policyContainmentRequired: true,
        panicRecommended,
        trustedActor
    }).catch(error => ({
        safe: false,
        supervisor: { healthy: false, problems: [`AI pipeline failure: ${error.message}`] }
    }));

    const inspection = aiSupervisor.inspect(guild.id, pipeline);
    await aiSupervisor.enforce(guild, inspection);
    if (!inspection.healthy) {
        console.warn("AI SUPERVISOR BLOCKED PIPELINE:", { guild: guild.id, executorId, actionType, reason: inspection.reason });
        await notifyOwnerOfDestruction(guild, executorId, actionType, count, {
            severity: "CRITICAL",
            containment: "AI supervisor blocked automatic containment"
        });
        return;
    }

    const approval = aiSupervisor.approveAction(guild.id, pipeline.plan.action);
    if (!approval.allowed) {
        await aiSupervisor.enforce(guild, { healthy: false, blocked: true, reason: approval.reason });
        await notifyOwnerOfDestruction(guild, executorId, actionType, count, {
            severity: "CRITICAL",
            containment: "Automatic containment blocked by safety policy"
        });
        return;
    }

    if (pipeline.plan.action === "MONITOR" || pipeline.plan.action === "VERIFY" || pipeline.plan.action === "ALERT_OWNER") {
        console.warn("AI ACTION:", { guild: guild.id, executorId, actionType, plan: pipeline.plan });
        if (pipeline.plan.action === "ALERT_OWNER") {
            await notifyOwnerOfDestruction(guild, executorId, actionType, count, {
                severity: "HIGH",
                containment: "Owner alert requested by security AI"
            });
        }
        return;
    }

    // The Action AI only produces an allowlisted plan. This deterministic gateway
    // remains the only layer allowed to perform Discord mutations.
    const result = await containMember(guild, executorId, reason);
    const quarantine = await quarantineMember(guild, executorId, reason).catch(() => ({ ok: false, reason: "Quarantine operation failed" }));

    if (pipeline.plan.action === "PANIC_MODE") {
        await triggerPanic(guild, "AI-verified repeated destructive activity", { executorId, actionType, count });
    }

    await reportContainment(guild, executorId, actionType, count, {
        ...result,
        quarantine,
        ai: {
            decision: pipeline.decision,
            verification: pipeline.verification,
            action: pipeline.plan,
            supervisor: pipeline.supervisor
        }
    });

    await notifyOwnerOfDestruction(guild, executorId, actionType, count, {
        severity: "CRITICAL",
        containment: result.ok ? result.action : `Containment failed: ${result.message}`,
        quarantine: quarantine.ok ? "Quarantine confirmed" : `Quarantine failed: ${quarantine.reason || "unknown reason"}`,
        trustedActor
    });

    console.warn("ANTI-NUKE:", { guild: guild.id, executorId, actionType, targetId, count, result, quarantine, ai: pipeline });
}

module.exports = { processSecurityAction };
