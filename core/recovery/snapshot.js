const snapshots=new Map();
function snapshotGuild(guild){const s={time:Date.now(),guildId:guild.id,roles:guild.roles.cache.map(r=>({id:r.id,name:r.name,permissions:r.permissions.bitfield.toString(),position:r.position})),channels:guild.channels.cache.map(c=>({id:c.id,name:c.name,type:c.type,parentId:c.parentId}))};const list=snapshots.get(guild.id)||[];list.push(s);if(list.length>20)list.shift();snapshots.set(guild.id,list);return s;}
function getSnapshot(id,index){const list=snapshots.get(id)||[];return list[index==null?list.length-1:index]||null;}
function getSnapshots(id){return snapshots.get(id)||[];}
module.exports={snapshotGuild,getSnapshot,getSnapshots};