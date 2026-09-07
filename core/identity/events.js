const { AuditLogEvent } = require("discord.js");
const store = require("./profileStore");
const { createEvidence } = require("../network/evidence");

function registerIdentityEvents(client) {
  client.on("guildMemberAdd", member => {
    try {
      const profile = store.memberJoin(member);
      client.emit("multiStrikerEvidence", createEvidence({
        type: member.user.bot ? "bot_observation" : "member_join",
        subjectId: member.user.id,
        sourceId: "local",
        guildId: member.guild.id,
        confidence: 70,
        data: {
          username: profile.current.username,
          globalName: profile.current.globalName,
          avatar: profile.current.avatar,
          accountCreatedAt: profile.accountCreatedAt,
          joinedAt: profile.guilds[member.guild.id]?.joinedAt ?? null
        }
      }));
    } catch (error) {
      console.error("Identity join observation failed:", error);
    }
  });

  client.on("guildMemberUpdate", (_oldMember, member) => {
    try {
      store.memberUpdate(member);
    } catch (error) {
      console.error("Identity member update failed:", error);
    }
  });

  client.on("guildMemberRemove", member => {
    try {
      store.memberLeave(member.user, member.guild);
    } catch (error) {
      console.error("Identity member leave observation failed:", error);
    }
  });

  client.on("guildAuditLogEntryCreate", async (entry, guild) => {
    if (entry.action !== AuditLogEvent.MemberBanAdd || !entry.targetId) return;
    try {
      const user = await client.users.fetch(entry.targetId);
      store.recordBan(user, guild, entry.reason ?? null, "local");
      client.emit("multiStrikerEvidence", createEvidence({
        type: "ban_observed",
        subjectId: user.id,
        sourceId: "local",
        guildId: guild.id,
        confidence: 90,
        reason: entry.reason ?? null,
        data: { executorId: entry.executorId ?? null }
      }));
    } catch (error) {
      console.error("Identity ban observation failed:", error);
    }
  });
}

module.exports = { registerIdentityEvents };
