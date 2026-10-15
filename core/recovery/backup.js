const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");

const dir=path.join(process.cwd(),"data","backups");
const slots=new Map();

function fileFor(guildId){return path.join(dir,`${guildId}.json`);}
function emptyDb(){return {main:null,previous:null,secondary:null,manual:null};}
function read(guildId){
  if(slots.has(guildId))return slots.get(guildId);
  let value=emptyDb();
  try{value={...emptyDb(),...JSON.parse(fs.readFileSync(fileFor(guildId),"utf8"))};}catch{}
  slots.set(guildId,value);
  return value;
}
function persist(guildId,value){
  fs.mkdirSync(dir,{recursive:true});
  const target=fileFor(guildId),tmp=target+`.${process.pid}.tmp`;
  fs.writeFileSync(tmp,JSON.stringify(value,null,2),{mode:0o600});
  fs.renameSync(tmp,target);
  slots.set(guildId,value);
}
function hash(value){
  const core={schema:value.schema,guildId:value.guildId,guildName:value.guildName,capturedAt:value.capturedAt,roles:value.roles,channels:value.channels};
  const data=JSON.stringify(core);
  const key=process.env.VORHEX_BACKUP_HMAC_KEY;
  return key?crypto.createHmac("sha256",key).update(data).digest("hex"):crypto.createHash("sha256").update(data).digest("hex");
}
function snapshot(guild){
  const roles=[...guild.roles.cache.values()].map(r=>({
    id:r.id,name:r.name,color:r.color,hoist:r.hoist,mentionable:r.mentionable,
    permissions:r.permissions.bitfield.toString(),position:r.position,managed:r.managed
  })).sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id));
  const channels=[...guild.channels.cache.values()].map(c=>({
    id:c.id,name:c.name,type:c.type,parentId:c.parentId??null,position:c.position??0,
    topic:c.topic??null,nsfw:Boolean(c.nsfw),rateLimitPerUser:c.rateLimitPerUser??0,
    bitrate:c.bitrate??null,userLimit:c.userLimit??null,
    permissionOverwrites:[...c.permissionOverwrites.cache.values()].map(o=>({
      id:o.id,type:o.type,allow:o.allow.bitfield.toString(),deny:o.deny.bitfield.toString()
    })).sort((a,b)=>a.id.localeCompare(b.id))
  })).sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id));
  return {schema:1,guildId:guild.id,guildName:guild.name,capturedAt:Date.now(),roles,channels};
}
function verifySnapshot(s,guildId){
  if(!s||s.schema!==1||s.guildId!==guildId||!Array.isArray(s.roles)||!Array.isArray(s.channels)||!Number.isFinite(s.capturedAt))return {ok:false,reason:"invalid_schema_or_guild"};
  if(s.roles.length>500||s.channels.length>500)return {ok:false,reason:"unexpected_snapshot_size"};
  const roleIds=new Set(),channelIds=new Set();
  for(const r of s.roles){
    if(typeof r.id!=="string"||typeof r.name!=="string"||typeof r.permissions!=="string"||roleIds.has(r.id))return {ok:false,reason:"invalid_or_duplicate_role_id"};
    roleIds.add(r.id);
  }
  for(const c of s.channels){
    if(typeof c.id!=="string"||typeof c.name!=="string"||!Number.isInteger(c.type)||channelIds.has(c.id)||!Array.isArray(c.permissionOverwrites))return {ok:false,reason:"invalid_or_duplicate_channel_id"};
    channelIds.add(c.id);
  }
  return {ok:true,hash:hash(s),verifiedAt:Date.now()};
}
async function fetchGuildState(guild){
  await guild.roles.fetch();
  await guild.channels.fetch();
}
async function capture(guild,{destructive=false,onlyIfMissing=false,reason="verified server change"}={}){
  await fetchGuildState(guild);
  const candidate=snapshot(guild),check=verifySnapshot(candidate,guild.id);
  if(!check.ok)throw new Error("Backup verification failed: "+check.reason);
  const db=read(guild.id);
  if(onlyIfMissing&&db.main?.trust==="VERIFIED"){
    const existing=verifySnapshot(db.main,guild.id);
    if(existing.ok&&db.main.integrityHash===existing.hash)return {slot:"main",trust:"VERIFIED",hash:existing.hash,existing:true};
  }
  const packed={...candidate,integrityHash:check.hash,verifiedAt:check.verifiedAt,reason};
  if(destructive){db.secondary={...packed,trust:"UNTRUSTED_PENDING_REVIEW"};persist(guild.id,db);return {slot:"secondary",trust:db.secondary.trust,hash:check.hash};}
  if(db.main?.trust==="VERIFIED"){
    const oldCheck=verifySnapshot(db.main,guild.id);
    if(oldCheck.ok&&db.main.integrityHash===oldCheck.hash)db.previous=db.main;
  }
  db.main={...packed,trust:"VERIFIED"};
  db.secondary=db.secondary||null;
  persist(guild.id,db);
  return {slot:"main",trust:"VERIFIED",hash:check.hash};
}
async function saveManual(guild,actorId){
  await fetchGuildState(guild);
  const candidate=snapshot(guild),check=verifySnapshot(candidate,guild.id);
  if(!check.ok)throw new Error("Manual backup verification failed: "+check.reason);
  const db=read(guild.id);
  db.manual={...candidate,integrityHash:check.hash,verifiedAt:check.verifiedAt,reason:"manual moderator backup",createdBy:actorId,trust:"VERIFIED_MANUAL"};
  persist(guild.id,db);
  return {slot:"manual",hash:check.hash,capturedAt:candidate.capturedAt};
}
function getSlots(guildId){const db=read(guildId);return {main:db.main,previous:db.previous||null,secondary:db.secondary,manual:db.manual||null};}
function promoteSecondary(guildId,actorId){
  const db=read(guildId),candidate=db.secondary;
  const check=candidate&&verifySnapshot(candidate,guildId);
  if(!candidate||candidate.trust!=="UNTRUSTED_PENDING_REVIEW"||!check?.ok||candidate.integrityHash!==check.hash)
    return {ok:false,reason:"secondary_missing_or_integrity_check_failed"};
  if(db.main?.trust==="VERIFIED"){
    const oldCheck=verifySnapshot(db.main,guildId);
    if(oldCheck.ok&&db.main.integrityHash===oldCheck.hash)db.previous=db.main;
  }
  db.main={...candidate,trust:"VERIFIED",promotedBy:actorId,promotedAt:Date.now(),reason:"manually reviewed secondary promotion"};
  db.secondary=null;
  persist(guildId,db);
  return {ok:true,hash:check.hash};
}
function compareToMain(guild){
  const current=snapshot(guild),main=read(guild.id).main;
  if(!main)return {comparable:false,reason:"no_main_backup"};
  const checked=verifySnapshot(main,guild.id);
  if(!checked.ok||main.integrityHash!==checked.hash)return {comparable:false,reason:"main_integrity_check_failed"};
  const mainRoleNames=new Set(main.roles.map(x=>x.name));
  const currentRoleNames=new Set(current.roles.map(x=>x.name));
  const mainChannelKeys=new Set(main.channels.map(x=>`${x.type}:${x.name}`));
  const currentChannelKeys=new Set(current.channels.map(x=>`${x.type}:${x.name}`));
  return {
    comparable:true,mainHash:main.integrityHash,currentHash:hash(current),
    missingRoles:main.roles.filter(r=>!currentRoleNames.has(r.name)),
    missingChannels:main.channels.filter(c=>!currentChannelKeys.has(`${c.type}:${c.name}`)),
    newRoles:current.roles.filter(r=>!mainRoleNames.has(r.name)),
    newChannels:current.channels.filter(c=>!mainChannelKeys.has(`${c.type}:${c.name}`)),
    currentMatchesMain:hash({...current,capturedAt:main.capturedAt})===main.integrityHash
  };
}
function toOverwriteOptions(entries,roleIdMap,guild){
  return entries.map(o=>{
    // @everyone overwrites use the guild ID; recreated roles use their new IDs.
    const mapped=o.id===guild.id?guild.id:(roleIdMap.get(o.id)||o.id);
    const isRoleOverwrite=o.type===0||o.type==="role";
    if(isRoleOverwrite&&mapped!==guild.id&&!guild.roles.cache.has(mapped))return null;
    // Keep member overwrites even if that member is not currently cached.
    if(!isRoleOverwrite&&o.type!==1&&o.type!=="member")return null;
    return {id:mapped,allow:BigInt(o.allow),deny:BigInt(o.deny),type:o.type};
  }).filter(Boolean);
}
async function restoreMissingStructure(guild,requestedSlot="main"){
  const db=read(guild.id),allowedSlots=new Set(["main","previous","secondary","manual"]);
  if(!allowedSlots.has(requestedSlot))return {ok:false,reason:"invalid_backup_slot"};
  const backup=db[requestedSlot],sourceSlot=requestedSlot;
  const acceptedTrust=requestedSlot==="manual"?"VERIFIED_MANUAL":requestedSlot==="secondary"?"UNTRUSTED_PENDING_REVIEW":"VERIFIED";
  const check=backup&&backup.trust===acceptedTrust?verifySnapshot(backup,guild.id):{ok:false};
  if(!backup||!check.ok||backup.integrityHash!==check.hash)return {ok:false,reason:"selected_backup_missing_or_integrity_check_failed",sourceSlot};
  if(requestedSlot==="secondary")return {ok:false,reason:"secondary_is_untrusted_evidence_and_cannot_be_restored_automatically",sourceSlot};
  try{await fetchGuildState(guild);}catch(error){return {ok:false,reason:"failed_to_fetch_current_guild_state: "+error.message,sourceSlot};}
  const report={ok:true,sourceSlot,restoredChannels:[],restoredRoles:[],skipped:[],beforeHash:hash(snapshot(guild)),backupHash:backup.integrityHash};
  const roleIdMap=new Map();
  for(const saved of backup.roles){
    if(saved.name==="@everyone"){roleIdMap.set(saved.id,guild.id);continue;}
    const existing=guild.roles.cache.find(r=>r.name===saved.name);
    if(existing){roleIdMap.set(saved.id,existing.id);continue;}
    if(saved.managed){report.skipped.push({type:"role",name:saved.name,reason:"managed role cannot be recreated by the bot"});continue;}
    try{
      const role=await guild.roles.create({name:saved.name,color:saved.color,hoist:saved.hoist,mentionable:saved.mentionable,permissions:BigInt(saved.permissions),reason:"VORHEX verified backup recovery"});
      roleIdMap.set(saved.id,role.id);report.restoredRoles.push({name:saved.name,id:role.id});
    }catch(error){report.skipped.push({type:"role",name:saved.name,reason:error.message});}
  }
  const sorted=[...backup.channels].sort((a,b)=>(a.type===4?-1:0)-(b.type===4?-1:0)||a.position-b.position);
  const channelIdMap=new Map();
  for(const saved of sorted){
    const existing=guild.channels.cache.find(c=>c.type===saved.type&&c.name===saved.name);
    if(existing){channelIdMap.set(saved.id,existing.id);continue;}
    try{
      const options={name:saved.name,type:saved.type,reason:"VORHEX verified backup recovery"};
      if(saved.type===4)options.permissionOverwrites=toOverwriteOptions(saved.permissionOverwrites,roleIdMap,guild);
      else{
        const parent= saved.parentId ? (channelIdMap.get(saved.parentId)||guild.channels.cache.get(saved.parentId)?.id) : null;
        if(parent)options.parent=parent;
        options.permissionOverwrites=toOverwriteOptions(saved.permissionOverwrites,roleIdMap,guild);
        if(saved.type===0){options.topic=saved.topic||undefined;options.nsfw=saved.nsfw;options.rateLimitPerUser=saved.rateLimitPerUser||0;}
        if(saved.type===2){options.bitrate=saved.bitrate||64000;options.userLimit=saved.userLimit||0;}
      }
      const created=await guild.channels.create(options);
      channelIdMap.set(saved.id,created.id);
      report.restoredChannels.push({name:saved.name,id:created.id,type:saved.type});
    }catch(error){report.skipped.push({type:"channel",name:saved.name,reason:error.message});}
  }
  report.note="Missing roles/channels and available permission overwrites are restored where Discord permissions allow. Member role assignments, messages, webhooks, integrations, and deleted forum posts/threads are not restored.";
  return report;
}
module.exports={capture,saveManual,verifySnapshot,getSlots,promoteSecondary,compareToMain,restoreMissingStructure};
