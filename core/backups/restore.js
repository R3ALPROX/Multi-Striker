const { getSnapshot }=require("./snapshot");
async function restoreMissing(guild,reason="Multi Striker emergency recovery"){
 const s=getSnapshot(guild.id); if(!s)return{ok:false,message:"No snapshot"};
 const result={ok:true,created:{roles:0,channels:0},restored:{overwrites:0},errors:[]};
 const roleNames=new Map(guild.roles.cache.map(r=>[r.name,r])); const roleMap=new Map();
 for(const r of [...(s.roles||[])].sort((a,b)=>a.position-b.position)){
  const existing=roleNames.get(r.name); if(existing){roleMap.set(r.id,existing.id);continue;}
  try{const created=await guild.roles.create({name:r.name,color:r.color,permissions:BigInt(r.permissions),hoist:r.hoist,mentionable:r.mentionable,reason});roleMap.set(r.id,created.id);roleNames.set(r.name,created);result.created.roles++;}
  catch(e){result.errors.push({type:"role",name:r.name,message:e.message});}
 }
 const channelsByName=new Map(guild.channels.cache.map(c=>[`${c.type}:${c.name}`,c]));
 for(const c of (s.channels||[]).sort((a,b)=>a.position-b.position)){
  let channel=channelsByName.get(`${c.type}:${c.name}`);
  if(!channel){try{channel=await guild.channels.create({name:c.name,type:c.type,topic:c.topic||undefined,nsfw:c.nsfw,rateLimitPerUser:c.rateLimitPerUser||0,reason});result.created.channels++;}catch(e){result.errors.push({type:"channel",name:c.name,message:e.message});continue;}}
  if(c.overwrites?.length && channel.permissionOverwrites?.set){
   try{const overwrites=c.overwrites.map(o=>({id:roleMap.get(o.id)||o.id,type:o.type,allow:BigInt(o.allow),deny:BigInt(o.deny)}));await channel.permissionOverwrites.set(overwrites,{reason});result.restored.overwrites++;}catch(e){result.errors.push({type:"overwrites",name:c.name,message:e.message});}
  }
 }
 return result;
}
function buildRestorePlan(guildId){const s=getSnapshot(guildId);return s?{takenAt:s.takenAt,roles:s.roles?.length||0,channels:s.channels?.length||0,overwrites:(s.channels||[]).reduce((n,c)=>n+(c.overwrites?.length||0),0),mode:"SAFE_MISSING_AND_OVERWRITES"}:null;}
module.exports={buildRestorePlan,restoreMissing};