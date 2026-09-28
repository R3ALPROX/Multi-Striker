const {PermissionFlagsBits}=require("discord.js");
const {N}=require("../identity/registry");

async function ensureRole(guild){
  let role=guild.roles.cache.find(r=>r.name===N.roles.quarantine);
  if(!role){
    role=await guild.roles.create({
      name:N.roles.quarantine,
      permissions:[],
      reason:"VORHEX immediate join quarantine"
    });
  }
  return role;
}

async function lockChannels(guild,role){
  const channels=[...guild.channels.cache.values()]
    .filter(channel=>channel.isTextBased?.()||channel.isVoiceBased?.());

  await Promise.allSettled(channels.map(channel =>
    channel.permissionOverwrites.edit(role.id,{
      [PermissionFlagsBits.ViewChannel]:false,
      [PermissionFlagsBits.SendMessages]:false,
      [PermissionFlagsBits.Connect]:false,
      [PermissionFlagsBits.Speak]:false
    })
  ));
}

async function quarantine(member,reason="Immediate join quarantine"){
  if(!member?.guild||member.user?.bot)return null;

  const role=await ensureRole(member.guild);
  const removableRoles=member.roles.cache.filter(currentRole => currentRole.id!==member.guild.id && currentRole.id!==role.id && currentRole.editable);
  if(removableRoles.size) await member.roles.remove(removableRoles,reason);
  await member.roles.add(role,reason);
  await lockChannels(member.guild,role);

  return {
    guildId:member.guild.id,
    memberId:member.id,
    roleId:role.id,
    reason,
    time:Date.now()
  };
}

async function release(member){
  if(!member?.guild)return false;
  const role=member.guild.roles.cache.find(r=>r.name===N.roles.quarantine);
  if(!role)return false;
  if(member.roles.cache.has(role.id)){
    await member.roles.remove(role,"VORHEX verification passed");
  }
  return true;
}

module.exports={ensureRole,quarantine,release};
