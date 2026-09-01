const {takeSnapshot}=require("./snapshot");
const timers=new Map();
function startBackupScheduler(client,intervalMs=3*60*60*1000){for(const guild of client.guilds.cache.values())takeSnapshot(guild);if(timers.has("main"))clearInterval(timers.get("main"));timers.set("main",setInterval(()=>{for(const guild of client.guilds.cache.values())takeSnapshot(guild);},intervalMs));}
module.exports={startBackupScheduler};