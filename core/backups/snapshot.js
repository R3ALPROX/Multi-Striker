const fs=require("fs"),path=require("path");
const DIR=path.join(__dirname,"../../data/backups");
function ensure(){if(!fs.existsSync(DIR))fs.mkdirSync(DIR,{recursive:true});}
function serializeOverwrites(channel){return [...(channel.permissionOverwrites?.cache||[])].map(o=>({id:o.id,type:o.type,allow:o.allow.bitfield.toString(),deny:o.deny.bitfield.toString()}));}
function takeSnapshot(guild){
 ensure(); const id=Date.now();
 const snapshot={version:2,id,takenAt:id,guild:{id:guild.id,name:guild.name,verificationLevel:guild.verificationLevel,defaultMessageNotifications:guild.defaultMessageNotifications,explicitContentFilter:guild.explicitContentFilter},roles:[...guild.roles.cache.values()].filter(r=>r.id!==guild.id&&!r.managed).map(r=>({id:r.id,name:r.name,color:r.color,permissions:r.permissions.bitfield.toString(),hoist:r.hoist,mentionable:r.mentionable,position:r.position})),channels:[...guild.channels.cache.values()].map(c=>({id:c.id,name:c.name,type:c.type,parentId:c.parentId,position:c.rawPosition,topic:c.topic||null,nsfw:!!c.nsfw,rateLimitPerUser:c.rateLimitPerUser||0,overwrites:serializeOverwrites(c)}))]};
 const file=path.join(DIR,guild.id+"-"+id+".json"); fs.writeFileSync(file,JSON.stringify(snapshot,null,2)); fs.writeFileSync(path.join(DIR,guild.id+".latest.json"),JSON.stringify(snapshot,null,2));
 const keep=10; const files=fs.readdirSync(DIR).filter(f=>f.startsWith(guild.id+"-")&&f.endsWith(".json")).sort().reverse(); for(const old of files.slice(keep))try{fs.unlinkSync(path.join(DIR,old));}catch{}
 return snapshot;
}
function getSnapshot(guildId,id=null){try{return JSON.parse(fs.readFileSync(path.join(DIR,id?guildId+"-"+id+".json":guildId+".latest.json"),"utf8"));}catch{return null;}}
function listSnapshots(guildId){ensure();return fs.readdirSync(DIR).filter(f=>f.startsWith(guildId+"-")&&f.endsWith(".json")).sort().reverse();}
module.exports={takeSnapshot,getSnapshot,listSnapshots};