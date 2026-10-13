const {PermissionFlagsBits,ChannelType}=require("discord.js");
const {N}=require("../identity/registry");
const held=new Map();
const dangerous=[
  PermissionFlagsBits.Administrator,PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.BanMembers,PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ManageWebhooks,PermissionFlagsBits.MentionEveryone
];
function risky(member){return dangerous.filter(p=>member.permissions.has(p)).length;}
async function ensureQuarantineRole(guild,reason){
  let role=guild.roles.cache.find(r=>r.name===N.roles.quarantine);
  if(!role)role=await guild.roles.create({name:N.roles.quarantine,permissions:[],reason});
  if(!role?.editable)throw new Error("quarantine_role_not_editable");
  const channels=[...guild.channels.cache.values()].filter(c=>c.type!==ChannelType.GuildCategory);
  const results=await Promise.allSettled(channels.map(channel=>channel.permissionOverwrites.edit(role.id,{
    ViewChannel:false,SendMessages:false,SendMessagesInThreads:false,CreatePublicThreads:false,
    CreatePrivateThreads:false,Connect:false,Speak:false,AddReactions:false,UseApplicationCommands:false
  },{reason:"VORHEX containment lockdown"})));
  const failures=results.filter(r=>r.status==="rejected").length;
  if(failures)console.error(`[VORHEX] Quarantine role lockdown incomplete in ${failures}/${channels.length} channels for ${guild.id}`);
  return role;
}
async function quarantine(guild,id,reason){
  const member=await guild.members.fetch(id).catch(()=>null);
  if(!member||id===guild.ownerId||id===guild.members.me?.id)return{ok:false,reason:"protected_or_unavailable"};
  const me=guild.members.me;
  if(!me?.permissions.has(PermissionFlagsBits.ManageRoles))return{ok:false,reason:"bot_missing_manage_roles"};
  if(member.roles.highest.position>=me.roles.highest.position)return{ok:false,reason:"hierarchy_block"};
  const key=`${guild.id}:${id}`;
  if(held.has(key))return{ok:true,already:true,action:"quarantine"};
  let role;
  try{role=await ensureQuarantineRole(guild,reason);}catch(e){return{ok:false,reason:e.message};}
  const saved=[...member.roles.cache.filter(r=>r.id!==guild.id&&!r.managed&&r.id!==role.id&&r.editable).keys()];
  const removed=[];
  try{
    for(const rid of saved){await member.roles.remove(rid,reason);removed.push(rid);}
    await member.roles.add(role,reason);
    await member.fetch(true);
    if(!member.roles.cache.has(role.id))throw new Error("quarantine_role_not_confirmed");
  }catch(e){
    for(const rid of removed){const r=guild.roles.cache.get(rid);if(r?.editable)await member.roles.add(r,`${reason} rollback`).catch(()=>{});}
    return{ok:false,reason:e.message,rolledBack:true};
  }
  held.set(key,{roleId:role.id,saved,at:Date.now()});
  return{ok:true,action:"quarantine",removed:saved.length,channelLockdown:"applied_with_possible_permission_errors"};
}
async function release(guild,id,restricted=false,reason="approved recovery"){
  const key=`${guild.id}:${id}`,rec=held.get(key);
  if(!rec)return{ok:false,reason:"not_held"};
  const member=await guild.members.fetch(id).catch(()=>null);
  if(!member)return{ok:false,reason:"member_unavailable"};
  const role=guild.roles.cache.get(rec.roleId);
  if(role?.editable&&member.roles.cache.has(role.id))await member.roles.remove(role,reason).catch(()=>{});
  let restored=0,withheld=0;
  for(const rid of rec.saved){
    const r=guild.roles.cache.get(rid);
    if(!r?.editable)continue;
    if(restricted&&dangerous.some(p=>r.permissions.has(p))){withheld++;continue;}
    await member.roles.add(r,reason).then(()=>restored++).catch(()=>{});
  }
  if(!restricted)held.delete(key);
  return{ok:true,restored,withheld};
}
function isHeld(guild,id){return held.has(`${guild.id}:${id}`);}
module.exports={quarantine,release,isHeld,risky};