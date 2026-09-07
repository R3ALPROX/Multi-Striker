const DANGEROUS = new Set([
  "Administrator", "ManageGuild", "ManageRoles", "ManageChannels",
  "BanMembers", "KickMembers", "ManageWebhooks", "ManageMessages",
  "MentionEveryone", "ManageThreads"
]);

function clamp(n, min = 0, max = 100) { return Math.max(min, Math.min(max, Number(n) || 0)); }

function extractFeatures(input = {}) {
  const recent = Array.isArray(input.recentEvents) ? input.recentEvents : [];
  const dangerousPerms = Array.isArray(input.dangerousPermissions) ? input.dangerousPermissions : [];
  const permissionEscalations = dangerousPerms.filter(p => DANGEROUS.has(String(p))).length;
  const destructive = recent.filter(e => /DELETE|BAN|KICK|OVERWRITE|WEBHOOK/i.test(String(e.type || ""))).length;
  const permissionEvents = recent.filter(e => /ROLE_UPDATE|PERMISSION/i.test(String(e.type || ""))).length;
  const uniqueActors = new Set(recent.map(e => String(e.actorId || "unknown"))).size;
  const botActors = new Set(recent.filter(e => e.isBot).map(e => String(e.actorId))).size;
  const joinCount = Number(input.joinCount) || 0;
  const trusted = Boolean(input.trustedActor);
  const protectedTarget = Boolean(input.protectedTarget);

  return {
    eventRate: clamp(recent.length),
    destructiveRate: clamp(destructive * 8),
    permissionEscalation: clamp(permissionEscalations * 18 + permissionEvents * 3),
    coordination: clamp((uniqueActors >= 3 ? 20 : 0) + (botActors >= 2 ? 15 : 0)),
    raidPressure: clamp(joinCount * 3),
    untrustedPenalty: trusted ? 0 : 8,
    protectedTarget: protectedTarget ? 20 : 0,
    evidenceCount: recent.length,
    uniqueActors,
    botActors,
    permissionEscalations,
    destructiveEvents: destructive,
    joinCount
  };
}

module.exports = { extractFeatures, clamp, DANGEROUS };