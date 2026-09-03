const {takeSnapshot}=require("./snapshot");
const timers=new Map();
function safeSnapshot(guild){try{return takeSnapshot(guild);}catch(error){console.error("Backup snapshot failed for guild "+guild.id+":",error);return null;}}
function startBackupScheduler(client,intervalMs=3*60*60*1000){
 for(const guild of client.guilds.cache.values())safeSnapshot(guild);
 if(timers.has("main"))clearInterval(timers.get("main"));
 timers.set("main",setInterval(()=>{for(const guild of client.guilds.cache.values())safeSnapshot(guild);},intervalMs));
}
module.exports={startBackupScheduler};