const { PermissionFlagsBits, ChannelType } = require("discord.js");
const { getGuildConfig } = require("../../config/manager");
const roleBackup = require("./roleBackup");
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
  if (!role) role = await guild.roles.create({ name:"Quarantined", permissions:[], reason:"Multi Striker quarantine system" });
  return role;
}

async function stripRoles(member, quarantineRole, reason) {
  const candidates = member.roles.cache.filter(r => r.id !== member.guild.id && !r.managed && r.id !== quarantineRole.id);
  const failed = [];
  for (const role of candidates.values()) {
    if (!role.editable) { failed.push(role.id); continue; }
    const ok = await member.roles.remove(role, reason).then(() => true).catch(() => false);
    if (!ok || member.roles.cache.has(role.id)) failed.push(role.id);
  }
  return { candidates:[...candidates.keys()], failed, managed:[...member.roles.cache.filter(r => r.id !== member.guild.id && r.managed).keys()] };
}

function buildHeldRecord(guild, memberId, roleId, backup, changedChannels, reason) {
  return { saved:backup.roles.filter(r => !r.managed).map(r => r.id), roleId, changedChannels, time:Date.now(), reason };
}

async function quarantineMember(guild, memberId, reason="Security containment") {
  const member = await guild.members.fetch(memberId).catch(() => null);
  if (!member || member.id === guild.ownerId) return {ok:false,reason:"Member unavailable or protected owner"};
  if (member.id === guild.members.me?.id) return {ok:false,reason:"Multi Striker cannot quarantine itself"};
  const key = guild.id+":"+memberId;
  const existingBackup = roleBackup.get(guild.id,memberId);
  if (held.has(key) || ["quarantined","restricted"].includes(existingBackup?.state)) return {ok:true,already:true,removed:0};

  const role = await getQuarantineRole(guild);
  if (!role.editable) return {ok:false,reason:"Quarantined role is above Multi Striker"};

  // Create exactly one durable recovery point before changing any roles. If a previous
  // attempt was interrupted, reuse its pending backup instead of overwriting it.
  const backup = existingBackup || roleBackup.create(guild,member,reason);
  const roleResult = await stripRoles(member,role,reason);
  if (roleResult.failed.length) return {
    ok:false,
    reason:"Quarantine failed closed: one or more roles could not be removed",
    failed:roleResult.failed,
    managed:roleResult.managed,
    removed:roleResult.candidates.length-roleResult.failed.length,
    backupCreated:true
  };

  const added = await member.roles.add(role,reason).then(()=>true).catch(()=>false);
  const refreshed = await guild.members.fetch(memberId).catch(()=>null);
  if (!added || !refreshed || !refreshed.roles.cache.has(role.id)) return {ok:false,reason:"Quarantine role could not be confirmed",backupCreated:true};

  roleBackup.markQuarantined(guild.id,memberId,role.id);
  const config = getGuildConfig(guild.id);
  const verificationChannelId = config.verification?.channelId;
  const changedChannels = [];
  for (const channel of guild.channels.cache.values()) {
    if (!channel.permissionOverwrites || channel.type===ChannelType.GuildCategory) continue;
    if (!channel.isTextBased?.() && channel.type!==ChannelType.GuildVoice && channel.type!==ChannelType.GuildStageVoice) continue;
    const before=channel.permissionOverwrites.cache.get(role.id);
    changedChannels.push({channelId:channel.id,allow:before?.allow?.bitfield?.toString()||"0",deny:before?.deny?.bitfield?.toString()||"0",had:!!before});
    if(channel.id===verificationChannelId) await channel.permissionOverwrites.edit(role,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true,Connect:false},{reason}).catch(()=>{});
    else await channel.permissionOverwrites.edit(role,{ViewChannel:false,SendMessages:false,Connect:false},{reason}).catch(()=>{});
  }

  held.set(key,buildHeldRecord(guild,memberId,role.id,roleBackup.get(guild.id,memberId),changedChannels,reason));
  return {ok:true,removed:roleResult.candidates.length,roleId:role.id,managed:roleResult.managed,backupCreated:true};
}

function getRecord(guild,memberId){
  const key=guild.id+":"+memberId;
  if(held.has(key))return held.get(key);
  const backup=roleBackup.get(guild.id,memberId);
  if(!backup || !["quarantined","restricted"].includes(backup.state))return null;
  const role=guild.roles.cache.get(backup.quarantineRoleId)||guild.roles.cache.find(r=>r.name==="Quarantined");
  if(!role)return null;
  const recovered=buildHeldRecord(guild,memberId,role.id,backup,[],backup.reason);
  held.set(key,recovered);return recovered;
}

async function restoreFromRecord(guild,memberId,reason,restricted){
  const key=guild.id+":"+memberId;
  const record=getRecord(guild,memberId);
  if(!record)return{ok:false,reason:"Not quarantined by this process"};
  const member=await guild.members.fetch(memberId).catch(()=>null);
  if(!member)return{ok:false,reason:"Member unavailable"};

  const quarantineRole=guild.roles.cache.get(record.roleId);
  if(quarantineRole?.editable&&member.roles.cache.has(quarantineRole.id))await member.roles.remove(quarantineRole,reason).catch(()=>{});
  const roles=record.saved.map(id=>guild.roles.cache.get(id)).filter(r=>r&&r.editable);
  const restored=[];const withheld=[];
  for(const savedRole of roles){
    if(restricted&&roleHasModerationPermissions(savedRole)){withheld.push(savedRole.id);continue;}
    await member.roles.add(savedRole,reason).then(()=>restored.push(savedRole.id)).catch(()=>{});
  }
  for(const saved of record.changedChannels||[]){
    const channel=guild.channels.cache.get(saved.channelId);if(!channel?.permissionOverwrites)continue;
    const existing=channel.permissionOverwrites.cache.get(record.roleId);
    if(!saved.had){if(existing?.editable)await channel.permissionOverwrites.delete(record.roleId,reason).catch(()=>{});}
    else await channel.permissionOverwrites.edit(record.roleId,{allow:BigInt(saved.allow),deny:BigInt(saved.deny)},{reason}).catch(()=>{});
  }

  if(restricted){
    roleBackup.markRestricted(guild.id,memberId);
    held.set(key,{...record,quarantineRoleId:record.roleId,time:Date.now(),restricted:true});
  }else{
    held.delete(key);roleBackup.remove(guild.id,memberId);
  }
  return{ok:true,restored:restored.length,withheld,quarantined:restricted};
}

async function releaseMember(guild,memberId,reason="Owner-approved release",actorId=null){
  if(actorId!==guild.ownerId)return{ok:false,reason:"Only the server owner can fully release a quarantined member"};
  return restoreFromRecord(guild,memberId,reason,false);
}

async function releaseMemberRestricted(guild,memberId,reason="Verified bot restricted release"){
  return restoreFromRecord(guild,memberId,reason,true);
}

function isQuarantined(guildId,memberId){
  const backup=roleBackup.get(guildId,memberId);
  return !!held.get(guildId+":"+memberId)||["quarantined","restricted"].includes(backup?.state);
}
function getHeldRecord(guildId,memberId){return held.get(guildId+":"+memberId)||roleBackup.get(guildId,memberId)||null;}
module.exports={quarantineMember,releaseMember,releaseMemberRestricted,isQuarantined,getHeldRecord,roleHasModerationPermissions};
