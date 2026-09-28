const {getGuildConfig}=require("../config/store");
const {verifyGuild}=require("../security/serverVerification");

const states=new Map();

function state(guildId){
  if(!states.has(guildId))states.set(guildId,{lastCheck:0,healthy:true,latency:0,members:0,bots:0,channels:0,roles:0,errors:0,verification:null});
  return states.get(guildId);
}

async function monitorGuild(guild){
  const s=state(guild.id);
  try{
    const fetched=await guild.fetch();
    const me=fetched.members?.me||guild.members.me;
    const verification=await verifyGuild(guild);

    s.lastCheck=Date.now();
    s.healthy=true;
    s.latency=guild.client.ws.ping;
    s.members=guild.memberCount||guild.members.cache.size;
    s.bots=verification.checkedBots;
    s.channels=guild.channels.cache.size;
    s.roles=guild.roles.cache.size;
    s.verification=verification;
    return getMonitoringState(guild);
  }catch(error){
    s.lastCheck=Date.now();
    s.healthy=false;
    s.errors++;
    console.error(`[VORHEX] Dashboard monitor failed for ${guild.id}:`,error);
    return getMonitoringState(guild);
  }
}

function getMonitoringState(guild){
  const s=state(guild.id);
  const cfg=getGuildConfig(guild.id);
  return {
    guildId:guild.id,
    guildName:guild.name,
    status:s.healthy?"HEALTHY":"DEGRADED",
    latency:s.latency,
    members:s.members,
    bots:s.bots,
    channels:s.channels,
    roles:s.roles,
    verificationAt:s.verification?.verifiedAt||null,
    lastCheck:s.lastCheck,
    errors:s.errors,
    dashboardEnabled:Boolean(cfg.dashboard?.channelId&&cfg.dashboard?.messageId)
  };
}

function startMonitoring(client,interval=30*1000){
  const run=()=>{for(const guild of client.guilds.cache.values())void monitorGuild(guild);};
  run();
  return setInterval(run,interval).unref();
}

module.exports={monitorGuild,getMonitoringState,startMonitoring};