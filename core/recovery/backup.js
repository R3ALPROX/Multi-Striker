const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");

const dir=path.join(process.cwd(),"data","backups");
const slots=new Map();

function fileFor(guildId){return path.join(dir,`${guildId}.json`);}
function read(guildId){
  if(slots.has(guildId))return slots.get(guildId);
  let value={main:null,secondary:null};
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
function hash(value){return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");}
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
  const roleNames=new Set(),channelNames=new Set();
  for(const r of s.roles){if(typeof r.name!=="string"||typeof r.permissions!=="string"||roleNames.has(r.name))return {ok:false,reason:"invalid_or_duplicate_role"};roleNames.add(r.name);}
  for(const c of s.channels){if(typeof c.name!=="string"||!Number.isInteger(c.type)||channelNames.has(c.id))return {ok:false,reason:"invalid_or_duplicate_channel"};channelNames.add(c.id);if(!Array.isArray(c.permissionOverwrites))return {ok:false,reason:"invalid_overwrites"};}
  return {ok:true,hash:hash(s),verifiedAt:Date.now()};
}
async function capture(guild,{destructive=false,reason="verified server change"}={}){
  await guild.roles.fetch().catch(()=>{});
  await guild.channels.fetch().catch(()=>{});
  const candidate=snapshot(guild),check=verifySnapshot(candidate,guild.id);
  if(!check.ok)throw new Error("Backup verification failed: "+check.reason);
  const db=read(guild.id);
  const packed={...candidate,integrityHash:check.hash,verifiedAt:check.verifiedAt,reason};
  if(destructive){
    db.secondary={...packed,trust:"UNTRUSTED_PENDING_REVIEW"};
    persist(guild.id,db);
    return {slot:"secondary",trust:db.secondary.trust,hash:check.hash};
  }
  db.main={...packed,trust:"VERIFIED"};
  db.secondary=db.secondary||null;
  persist(guild.id,db);
  return {slot:"main",trust:"VERIFIED",hash:check.hash};
}
function getSlots(guildId){const db=read(guildId);return {main:db.main,secondary:db.secondary};}
function compareToMain(guild){
  const current=snapshot(guild),main=read(guild.id).main;
  if(!main)return {comparable:false,reason:"no_main_backup"};
  const checked=verifySnapshot(main,guild.id);
  if(!checked.ok||main.integrityHash!==checked.hash)return {comparable:false,reason:"main_integrity_check_failed"};
  const roleNames=new Set(current.roles.map(x=>x.name)),channelIds=new Set(current.channels.map(x=>x.id));
  return {comparable:true,mainHash:main.integrityHash,currentHash:hash(current),missingRoles:main.roles.filter(r=>!current.roles.some(c=>c.name===r.name)),missingChannels:main.channels.filter(c=>!channelIds.has(c.id)),newRoles:current.roles.filter(r=>!main.roles.some(c=>c.name===r.name)),newChannels:current.channels.filter(c=>!main.channels.some(m=>m.id===c.id)),currentMatchesMain:hash({...current,capturedAt:main.capturedAt})===main.integrityHash};
}
async function restoreMissingStructure(guild){
  const db=read(guild.id),backup=db.main;
  if(!backup||backup.trust!=="VERIFIED")return {ok:false,reason:"no_verified_main_backup"};
  const check=verifySnapshot(backup,guild.id);
  if(!check.ok||backup.integrityHash!==check.hash)return {ok:false,reason:"backup_integrity_check_failed"};
  await guild.roles.fetch().catch(()=>{});await guild.channels.fetch().catch(()=>{});
  const before=snapshot(guild);
  const deletedChannels=backup.channels.filter(c=>!guild.channels.cache.has(c.id));
  const deletedRoles=backup.roles.filter(r=>!guild.roles.cache.some(x=>x.name===r.name)&&!r.managed&&r.name!=="@everyone");
  const report={ok:true,restoredChannels:[],restoredRoles:[],skipped:[],beforeHash:hash(before),backupHash:backup.integrityHash};
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
module.exports={capture,verifySnapshot,getSlots,compareToMain,restoreMissingStructure};
