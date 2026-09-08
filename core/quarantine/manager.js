const { PermissionFlagsBits, ChannelType } = require("discord.js");
const { getGuildConfig } = require("../../config/manager");
const held = new Map();

const MODERATION_PERMISSIONS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.MentionEveryone,
  PermissionFlagsBits.ManageThreads
];

function roleHasModerationPermissions(role) {
  return MODERATION_PERMISSIONS.some(permission => role.permissions.has(permission));
}

async function getQuarantineRole(guild) {
  let role = guild.roles.cache.find(r => r.name === "Quarantined");
  if (!role) {
    role = await guild.roles.create({
      name: "Quarantined",
      permissions: [],
      reason: "Multi Striker quarantine system"
    });
  }
  return role;
}

async function stripRoles(member, quarantineRole, reason) {
  const candidates = member.roles.cache.filter(r => r.id !== member.guild.id && !r.managed && r.id !== quarantineRole.id);
  const saved = [...candidates.keys()];
  const failed = [];
  for (const role of candidates.values()) {
    if (!role.editable) { failed.push(role.id); continue; }
    const ok = await member.roles.remove(role, reason).then(() => true).catch(() => false);
    if (!ok || member.roles.cache.has(role.id)) failed.push(role.id);
  }
  return { saved, failed, managed: [...member.roles.cache.filter(r => r.id !== member.guild.id && r.managed).keys()] };
}

async function quarantineMember(guild, memberId, reason="Security containment") {
  const member = await guild.members.fetch(memberId).catch(() => null);
  if (!member || member.id === guild.ownerId) return {ok:false,reason:"Member unavailable or protected owner"};
  if (member.id === guild.members.me?.id) return {ok:false,reason:"Multi Striker cannot quarantine itself"};
  const key = guild.id + ":" + memberId;
  if (held.has(key)) return {ok:true,already:true,removed:0};

  const role = await getQuarantineRole(guild);
  if (!role.editable) return {ok:false,reason:"Quarantined role is above Multi Striker"};

  // Snapshot roles BEFORE modifying the member. This is the recovery point.
  const roleResult = await stripRoles(member, role, reason);
  if (roleResult.failed.length) {
    return {ok:false,reason:"Quarantine failed closed: one or more roles could not be removed",failed:roleResult.failed,managed:roleResult.managed,removed:roleResult.saved.length-roleResult.failed.length};
  }

  await member.roles.add(role, reason).catch(() => {});
  const refreshed = await guild.members.fetch(memberId).catch(() => null);
  if (!refreshed || !refreshed.roles.cache.has(role.id)) return {ok:false,reason:"Quarantine role could not be confirmed"};

  const config = getGuildConfig(guild.id);
  const verificationChannelId = config.verification?.channelId;
  const changedChannels = [];
  for (const channel of guild.channels.cache.values()) {
    if (!channel.permissionOverwrites || channel.type === ChannelType.GuildCategory) continue;
    if (!channel.isTextBased?.() && channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice) continue;
    const before = channel.permissionOverwrites.cache.get(role.id);
    changedChannels.push({channelId:channel.id,allow:before?.allow?.bitfield?.toString()||"0",deny:before?.deny?.bitfield?.toString()||"0",had:!!before});
    if (channel.id === verificationChannelId) await channel.permissionOverwrites.edit(role,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true,Connect:false},{reason}).catch(()=>{});
    else await channel.permissionOverwrites.edit(role,{ViewChannel:false,SendMessages:false,Connect:false},{reason}).catch(()=>{});
  }

  // In-memory recovery record. The saved role IDs are the pre-quarantine state.
  held.set(key,{saved:roleResult.saved,roleId:role.id,changedChannels,time:Date.now(),reason});
  return {ok:true,removed:roleResult.saved.length,roleId:role.id,managed:roleResult.managed};
}

async function restoreFromRecord(guild, memberId, reason, restricted) {
  const key = guild.id + ":" + memberId;
  const record = held.get(key);
  if (!record) return {ok:false,reason:"Not quarantined by this process"};
  const member = await guild.members.fetch(memberId).catch(() => null);
  if (!member) return {ok:false,reason:"Member unavailable"};

  const role = guild.roles.cache.get(record.roleId);
  if (role?.editable && member.roles.cache.has(role.id)) await member.roles.remove(role, reason).catch(() => {});

  const roles = record.saved.map(id => guild.roles.cache.get(id)).filter(r => r && r.editable);
  const restored = [];
  const withheld = [];
  for (const savedRole of roles) {
    if (restricted && roleHasModerationPermissions(savedRole)) { withheld.push(savedRole.id); continue; }
    await member.roles.add(savedRole, reason).then(()=>restored.push(savedRole.id)).catch(()=>{});
  }

  for (const saved of record.changedChannels || []) {
    const channel = guild.channels.cache.get(saved.channelId);
    if (!channel?.permissionOverwrites) continue;
    const existing = channel.permissionOverwrites.cache.get(record.roleId);
    if (!saved.had) { if (existing?.editable) await channel.permissionOverwrites.delete(record.roleId, reason).catch(() => {}); }
    else await channel.permissionOverwrites.edit(record.roleId,{allow:BigInt(saved.allow),deny:BigInt(saved.deny)},{reason}).catch(() => {});
  }

  // Restricted release deliberately keeps privileged roles withheld and therefore keeps the
  // quarantine record alive until an explicit owner-authorized full release occurs.
  if (!restricted) held.delete(key);
  return {ok:true,restored:restored.length,withheld,quarantined:restricted};
}

// Full release is intended for explicit owner authorization only.
async function releaseMember(guild, memberId, reason="Owner-approved release") {
  return restoreFromRecord(guild,memberId,reason,false);
}

// Only a trusted Multi-Striker self-verification path may use this, and it is restricted.
async function releaseMemberRestricted(guild, memberId, reason="Multi Striker verified restricted release") {
  return restoreFromRecord(guild,memberId,reason,true);
}

function isQuarantined(guildId,memberId){return held.has(guildId+":"+memberId);}
function getHeldRecord(guildId,memberId){return held.get(guildId+":"+memberId)||null;}
module.exports={quarantineMember,releaseMember,releaseMemberRestricted,isQuarantined,getHeldRecord,roleHasModerationPermissions};
