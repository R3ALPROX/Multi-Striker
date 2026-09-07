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

async function quarantineMember(guild, memberId, reason="Security containment") {
  const member = await guild.members.fetch(memberId).catch(() => null);
  if (!member || member.id === guild.ownerId) return {ok:false,reason:"Member unavailable or protected owner"};
  if (member.id === guild.members.me?.id) return {ok:false,reason:"Multi Striker cannot quarantine itself"};

  const role = await getQuarantineRole(guild);
  if (!role.editable) return {ok:false,reason:"Quarantined role is above Multi Striker"};

  const key = guild.id + ":" + memberId;
  if (held.has(key)) return {ok:true,already:true,removed:0};

  const removable = member.roles.cache.filter(r => r.id !== guild.id && !r.managed && r.editable && r.id !== role.id);
  const saved = [...removable.keys()];
  if (removable.size) await member.roles.remove(removable, reason);
  await member.roles.add(role, reason);

  const config = getGuildConfig(guild.id);
  const verificationChannelId = config.verification?.channelId;
  const changedChannels = [];

  for (const channel of guild.channels.cache.values()) {
    if (!channel.permissionOverwrites || channel.type === ChannelType.GuildCategory) continue;
    if (!channel.isTextBased?.() && channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice) continue;
    const before = channel.permissionOverwrites.cache.get(role.id);
    changedChannels.push({channelId:channel.id,allow:before?.allow?.bitfield?.toString()||"0",deny:before?.deny?.bitfield?.toString()||"0",had:!!before});
    if (channel.id === verificationChannelId) {
      await channel.permissionOverwrites.edit(role,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true,Connect:false},{reason}).catch(()=>{});
    } else {
      await channel.permissionOverwrites.edit(role,{ViewChannel:false,SendMessages:false,Connect:false},{reason}).catch(()=>{});
    }
  }

  held.set(key,{saved,roleId:role.id,changedChannels,time:Date.now(),reason});
  return {ok:true,removed:saved.length,roleId:role.id};
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
    if (restricted && roleHasModerationPermissions(savedRole)) {
      withheld.push(savedRole.id);
      continue;
    }
    await member.roles.add(savedRole, reason).then(()=>restored.push(savedRole.id)).catch(()=>{});
  }

  for (const saved of record.changedChannels || []) {
    const channel = guild.channels.cache.get(saved.channelId);
    if (!channel?.permissionOverwrites) continue;
    const existing = channel.permissionOverwrites.cache.get(record.roleId);
    if (!saved.had) {
      if (existing?.editable) await channel.permissionOverwrites.delete(record.roleId, reason).catch(() => {});
    } else {
      await channel.permissionOverwrites.edit(record.roleId,{allow:BigInt(saved.allow),deny:BigInt(saved.deny)},{reason}).catch(() => {});
    }
  }

  held.delete(key);
  return {ok:true,restored:restored.length,withheld};
}

async function releaseMember(guild, memberId, reason="Owner-approved release") {
  return restoreFromRecord(guild,memberId,reason,false);
}

async function releaseMemberRestricted(guild, memberId, reason="Verified bot restricted release") {
  return restoreFromRecord(guild,memberId,reason,true);
}

function isQuarantined(guildId,memberId){return held.has(guildId+":"+memberId);}
function getHeldRecord(guildId,memberId){return held.get(guildId+":"+memberId)||null;}
module.exports={quarantineMember,releaseMember,releaseMemberRestricted,isQuarantined,getHeldRecord,roleHasModerationPermissions};
