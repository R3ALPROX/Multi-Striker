const fs=require("fs"),path=require("path");
const DIR=path.join(__dirname,"../../data/backups");
function ensure(){if(!fs.existsSync(DIR))fs.mkdirSync(DIR,{recursive:true});}
function takeSnapshot(guild){ensure();const snapshot={takenAt:Date.now(),guild:{name:guild.name},roles:[...guild.roles.cache.values()].filter(r=>r.id!==guild.id&&!r.managed).map(r=>({name:r.name,color:r.color,permissions:r.permissions.bitfield.toString(),hoist:r.hoist,mentionable:r.mentionable,position:r.position})),channels:[...guild.channels.cache.values()].map(c=>({name:c.name,type:c.type,parentId:c.parentId,position:c.rawPosition,topic:c.topic||null,nsfw:!!c.nsfw,rateLimitPerUser:c.rateLimitPerUser||0}))};const file=path.join(DIR,guild.id+".json");fs.writeFileSync(file,JSON.stringify(snapshot,null,2));return snapshot;}
function getSnapshot(guildId){try{return JSON.parse(fs.readFileSync(path.join(DIR,guildId+".json"),"utf8"));}catch{return null;}}
module.exports={takeSnapshot,getSnapshot};