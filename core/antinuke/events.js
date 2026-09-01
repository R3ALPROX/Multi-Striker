const { AuditLogEvent } = require("discord.js");
const { processSecurityAction } = require("./detector");
const { inspectBotAction } = require("../botSecurity/behavior");
const { analyzeContext } = require("../ai/analyzer");
const { update } = require("../security/adaptiveLevel");

const MAP = new Map([
    [AuditLogEvent.ChannelDelete, "channelDelete"], [AuditLogEvent.ChannelCreate, "channelCreate"],
    [AuditLogEvent.RoleDelete, "roleDelete"], [AuditLogEvent.RoleCreate, "roleCreate"],
    [AuditLogEvent.RoleUpdate, "roleUpdate"], [AuditLogEvent.MemberBanAdd, "ban"],
    [AuditLogEvent.MemberKick, "kick"], [AuditLogEvent.WebhookCreate, "webhookCreate"]
]);

function registerAntiNukeEvents(client) {
    client.on("guildAuditLogEntryCreate", async (entry, guild) => {
        try {
            const type = MAP.get(entry.action);
            if (!type) return;
            const member = await guild.members.fetch(entry.executorId).catch(() => null);
            if (member?.user.bot) {
                const botRisk = await inspectBotAction(guild, entry.executorId, type);
                const context = analyzeContext({ massActions: botRisk.risk >= 60, targetedSecurityBot: false });
                update(guild.id, Math.max(botRisk.risk, context.risk));
            }
            await processSecurityAction(guild, entry.executorId, type, entry.targetId);
        } catch (error) { console.error("Anti-nuke event error:", error); }
    });
}
module.exports = { registerAntiNukeEvents };