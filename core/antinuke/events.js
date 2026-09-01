const { AuditLogEvent } = require("discord.js");
const { processSecurityAction } = require("./detector");

const MAP = new Map([
    [AuditLogEvent.ChannelDelete, "channelDelete"],
    [AuditLogEvent.ChannelCreate, "channelCreate"],
    [AuditLogEvent.RoleDelete, "roleDelete"],
    [AuditLogEvent.RoleCreate, "roleCreate"],
    [AuditLogEvent.RoleUpdate, "roleUpdate"],
    [AuditLogEvent.MemberBanAdd, "ban"],
    [AuditLogEvent.MemberKick, "kick"],
    [AuditLogEvent.WebhookCreate, "webhookCreate"]
]);

function registerAntiNukeEvents(client) {
    client.on("guildAuditLogEntryCreate", async (entry, guild) => {
        try {
            const type = MAP.get(entry.action);
            if (!type) return;
            await processSecurityAction(guild, entry.executorId, type, entry.targetId);
        } catch (error) {
            console.error("Anti-nuke event error:", error);
        }
    });
}

module.exports = { registerAntiNukeEvents };
