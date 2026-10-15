const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");

const dir=path.join(process.cwd(),"data","backups");
const slots=new Map();

function fileFor(guildId){return path.join(dir,`${guildId}.json`);}
function read(guildId){
  if(slots.has(guildId))return slots.get(guildId);
  let value={main:null,previous:null,secondary:null,manual:null};
  try{value=JSON.parse(fs.readFileSync(fileFor(guildId),"utf8"));}catch{}
  slots.set(guildId,value);
  return value;
}
function persist(guildId,value){
  fs.mkdirSync(dir,{recursive:true});
  const target=fileFor(guildId),tmp=target+".tmp";
  fs.writeFileSync(tmp,JSON.stringify(value,null,2));
  fs.renameSync(tmp,target);
  slots.set(guildId,value);
}
function stable(value){return JSON.stringify(value,Object.keys(value||{}).sort());}
function hash(value){const core={schema:value.schema,guildId:value.guildId,guildName:value.guildName,capturedAt:value.capturedAt,roles:value.roles,channels:value.channels};return crypto.createHash("sha256").update(JSON.stringify(core)).digest("hex");}
function snapshot(guild){
  const roles=[...guild.roles.cache.values()].map(r=>({
    id:r.id,name:r.name,color:r.color,hoist:r.hoist,mentionable:r.mentionable,
    permissions:r.permissions.bitfield.toString(),position:r.position,managed:r.managed
  })).sort((a,b)=>a.position-b.position||a.name.localeCompare(b.name));
  const channels=[...guild.channels.cache.values()].map(c=>({
    id:c.id,name:c.name,type:c.type,parentId:c.parentId??null,position:c.position??0,
    topic:c.topic??null,nsfw:Boolean(c.nsfw),rateLimitPerUser:c.rateLimitPerUser??0,
    bitrate:c.bitrate??null,userLimit:c.userLimit??null,
    permissionOverwrites:[...c.permissionOverwrites.cache.values()].map(o=>({
      id:o.id,type:o.type,allow:o.allow.bitfield.toString(),deny:o.deny.bitfield.toString()
    })).sort((a,b)=>a.id.localeCompare(b.id))
  })).sort((a,b)=>a.position-b.position||a.name.localeCompare(b.name));
  return {schema:1,guildId:guild.id,guildName:guild.name,capturedAt:Date.now(),roles,channels};
}
function verifySnapshot(s,guildId){
  if(!s||s.schema!==1||s.guildId!==guildId||!Array.isArray(s.roles)||!Array.isArray(s.channels))return {ok:false,reason:"invalid_schema_or_guild"};
  if(s.roles.length>500||s.channels.length>500)return {ok:false,reason:"unexpected_snapshot_size"};
  const roleIds=new Set(),channelIds=new Set();
  for(const r of s.roles){
    if(typeof r.id!=="string"||typeof r.name!=="string"||typeof r.permissions!=="string"||roleIds.has(r.id))
      return {ok:false,reason:"invalid_or_duplicate_role_id"};
    roleIds.add(r.id);
  }
  for(const c of s.channels){
    if(typeof c.id!=="string"||typeof c.name!=="string"||!Number.isInteger(c.type)||channelIds.has(c.id))
      return {ok:false,reason:"invalid_or_duplicate_channel_id"};
    channelIds.add(c.id);
    if(!Array.isArray(c.permissionOverwrites))return {ok:false,reason:"invalid_overwrites"};
  }
  return {ok:true,hash:hash(s),verifiedAt:Date.now()};
}
async function capture(guild,{destructive=false,reason="verified server change"}={}){
  await guild.roles.fetch().catch(()=>{});
  await guild.channels.fetch().catch(()=>{});
  const candidate=snapshot(guild),check=verifySnapshot(candidate,guild.id);
  if(!check.ok)throw new Error("Backup verification failed: "+check.reason);
  const db=read(guild.id);
  if(!Object.prototype.hasOwnProperty.call(db,"previous"))db.previous=null;
  if(!Object.prototype.hasOwnProperty.call(db,"manual"))db.manual=null;
  const packed={...candidate,integrityHash:check.hash,verifiedAt:check.verifiedAt,reason};
  if(destructive){
    db.secondary={...packed,trust:"UNTRUSTED_PENDING_REVIEW"};
    persist(guild.id,db);
    return {slot:"secondary",trust:db.secondary.trust,hash:check.hash};
  }
  // Preserve the last independently integrity-checked MAIN before promoting a new one.
  // Never promote a pending/destructive capture into either trusted slot.
  if(db.main&&db.main.trust==="VERIFIED"){
    const oldCheck=verifySnapshot(db.main,guild.id);
    if(oldCheck.ok&&db.main.integrityHash===oldCheck.hash)db.previous=db.main;
  }
  db.main={...packed,trust:"VERIFIED"};
  db.previous=db.previous||null;
  db.secondary=db.secondary||null;
  persist(guild.id,db);
  return {slot:"main",trust:"VERIFIED",hash:check.hash};
}
async function saveManual(guild,actorId){
  await guild.roles.fetch().catch(()=>{});
  await guild.channels.fetch().catch(()=>{});
  const candidate=snapshot(guild),check=verifySnapshot(candidate,guild.id);
  if(!check.ok)throw new Error("Manual backup verification failed: "+check.reason);
  const db=read(guild.id);
  db.manual={...candidate,integrityHash:check.hash,verifiedAt:check.verifiedAt,reason:"manual moderator backup",createdBy:actorId,trust:"VERIFIED_MANUAL"};
  persist(guild.id,db);
  return {slot:"manual",hash:check.hash,capturedAt:candidate.capturedAt};
}
function getSlots(guildId){const db=read(guildId);return {main:db.main,previous:db.previous||null,secondary:db.secondary,manual:db.manual||null};}
function compareToMain(guild){
  const current=snapshot(guild),main=read(guild.id).main;
  if(!main)return {comparable:false,reason:"no_main_backup"};
  const checked=verifySnapshot(main,guild.id);
  if(!checked.ok||main.integrityHash!==checked.hash)return {comparable:false,reason:"main_integrity_check_failed"};
  const roleNames=new Set(current.roles.map(x=>x.name)),channelIds=new Set(current.channels.map(x=>x.id));
  return {comparable:true,mainHash:main.integrityHash,currentHash:hash(current),missingRoles:main.roles.filter(r=>!current.roles.some(c=>c.name===r.name)),missingChannels:main.channels.filter(c=>!channelIds.has(c.id)),newRoles:current.roles.filter(r=>!main.roles.some(c=>c.name===r.name)),newChannels:current.channels.filter(c=>!main.channels.some(m=>m.id===c.id)),currentMatchesMain:hash({...current,capturedAt:main.capturedAt})===main.integrityHash};
}
async function restoreMissingStructure(guild,requestedSlot="main"){
  const db=read(guild.id);
  const allowedSlots=new Set(["main","previous","secondary","manual"]);
  if(!allowedSlots.has(requestedSlot))return {ok:false,reason:"invalid_backup_slot"};
  const backup=db[requestedSlot],sourceSlot=requestedSlot;
  const acceptedTrust=requestedSlot==="manual"?"VERIFIED_MANUAL":requestedSlot==="secondary"?"UNTRUSTED_PENDING_REVIEW":"VERIFIED";
  const check=backup&&backup.trust===acceptedTrust?verifySnapshot(backup,guild.id):{ok:false};
  if(!backup||!check.ok||backup.integrityHash!==check.hash)
    return {ok:false,reason:"selected_backup_missing_or_integrity_check_failed",sourceSlot:requestedSlot};
  await guild.roles.fetch().catch(()=>{});await guild.channels.fetch().catch(()=>{});
  const before=snapshot(guild);
  const deletedChannels=backup.channels.filter(c=>!guild.channels.cache.has(c.id));
  const deletedRoles=backup.roles.filter(r=>!guild.roles.cache.some(x=>x.name===r.name)&&!r.managed&&r.name!=="@everyone");
  const report={ok:true,sourceSlot,restoredChannels:[],restoredRoles:[],skipped:[],beforeHash:hash(before),backupHash:backup.integrityHash};
  for(const r of deletedRoles){
    try{
      const role=await guild.roles.create({name:r.name,color:r.color,hoist:r.hoist,mentionable:r.mentionable,permissions:BigInt(r.permissions),reason:"VORHEX verified-main recovery"});
      report.restoredRoles.push({name:r.name,id:role.id});
    }catch(e){report.skipped.push({type:"role",name:r.name,reason:e.message});}
  }
  for(const c of deletedChannels){
    try{
      const options={name:c.name,type:c.type,reason:"VORHEX verified-main recovery"};
      if(c.type===0){options.topic=c.topic||undefined;options.nsfw=c.nsfw;options.rateLimitPerUser=c.rateLimitPerUser||0;}
      if(c.type===2){options.bitrate=c.bitrate||64000;options.userLimit=c.userLimit||0;}
      const created=await guild.channels.create(options);
      report.restoredChannels.push({name:c.name,id:created.id,type:c.type});
    }catch(e){report.skipped.push({type:"channel",name:c.name,reason:e.message});}
  }
  report.note="Restores missing roles/channels only; it does not restore messages, member role assignments, integrations, webhooks, or all channel overwrites.";
  return report;
}
module.exports={capture,saveManual,verifySnapshot,getSlots,compareToMain,restoreMissingStructure};
