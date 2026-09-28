const {ChannelType,PermissionFlagsBits}=require("discord.js");
const {N}=require("../identity/registry");
const {getGuildConfig,updateGuildConfig}=require("../config/store");

const states=new Map();
const {getMonitoringState}=require("./monitor");

function getState(guild){
  let s=states.get(guild.id);
  if(!s){
    s={startedAt:Date.now(),incidents:0,blocked:0,snapshots:0,threat:"LOW",status:"PROTECTED",lastUpdate:0,events:[],latestSnapshot:null,latestIncident:null};
    states.set(guild.id,s);
  }
  return s;
}

function fmt(ms){
  const total=Math.max(0,Math.floor(ms/1000));
  const d=Math.floor(total/86400),h=Math.floor(total%86400/3600),m=Math.floor(total%3600/60),s=total%60;
  return d?(`${d}d ${String(h).padStart(2,"0")}h`):h?(`${h}h ${String(m).padStart(2,"0")}m`):`${m}m ${String(s).padStart(2,"0")}s`;
}

function dashboardText(guild){
  const s=getState(guild);
  const m=getMonitoringState(guild);
  const threat=s.threat;
  const status=s.status;
  return [
    "╔══════════════════════════════╗",
    "║          VORHEX              ║",
    "╠══════════════════════════════╣",
    `║ STATUS       ● ${status.padEnd(14)}║`,
    `║ THREAT       ${threat.padEnd(14)}║`,
    `║ INCIDENTS    ${String(s.incidents).padEnd(14)}║`,
    `║ BLOCKED      ${String(s.blocked).padEnd(14)}║`,
    `║ SNAPSHOTS    ${String(s.snapshots).padEnd(14)}║`,
    `║ UPTIME       ${fmt(Date.now()-s.startedAt).padEnd(14)}║`,
    `║ MONITOR      ${m.status.padEnd(14)}║`,
    `║ LATENCY      ${String(m.latency)+"ms"}`.padEnd(31)+"║",
    `║ MEMBERS      ${String(m.members).padEnd(14)}║`,
    `║ BOTS         ${String(m.bots).padEnd(14)}║`,
    `║ CHANNELS     ${String(m.channels).padEnd(14)}║`,
    "╠══════════════════════════════╣",
    "║ LIVE SECURITY FEED           ║",
    ...(s.events.length?s.events.slice(-5).reverse().map(e=>`║ ${e.time} • ${e.text}`.slice(0,31).padEnd(30)+"║"):["║ No recent security events.   ║"]),
    "╠══════════════════════════════╣",
    "║ LATEST INCIDENT              ║",
    `║ ${(s.latestIncident?.title||"None").slice(0,28).padEnd(28)} ║`,
    "╠══════════════════════════════╣",
    "║ RECOVERY BASELINE            ║",
    `║ ${s.latestSnapshot?`Captured ${new Date(s.latestSnapshot.time).toLocaleTimeString()}`:"Waiting for snapshot"}`.slice(0,30).padEnd(30)+"║",
    "╠══════════════════════════════╣",
    "║          ● LIVE              ║",
    `║ Last update ${new Date().toLocaleTimeString().padEnd(12)}║`,
    "╚══════════════════════════════╝"
  ].join("\n");
}

async function refresh(guild){
  const cfg=getGuildConfig(guild.id);
  if(!cfg.dashboard?.messageId||!cfg.dashboard?.channelId)return false;
  const ch=guild.channels.cache.get(cfg.dashboard.channelId)||await guild.channels.fetch(cfg.dashboard.channelId).catch(()=>null);
  if(!ch?.isTextBased())return false;
  const msg=await ch.messages.fetch(cfg.dashboard.messageId).catch(()=>null);
  if(!msg)return false;
  getState(guild).lastUpdate=Date.now();
  await msg.edit({content:"```\n"+dashboardText(guild)+"\n```"}).catch(()=>{});
  return true;
}

async function ensureDashboard(guild){
  const cfg=getGuildConfig(guild.id);
  let ch=cfg.dashboard?.channelId?guild.channels.cache.get(cfg.dashboard.channelId):null;
  if(!ch)ch=guild.channels.cache.find(c=>c.name==="vorhex-dashboard"&&c.type===ChannelType.GuildText);
  if(!ch)ch=await guild.channels.create({
    name:"vorhex-dashboard",
    type:ChannelType.GuildText,
    reason:"VORHEX automatic live dashboard initialization"
  });
  const state=getState(guild);
  if(!state.startedAt)state.startedAt=Date.now();
  let msg=cfg.dashboard?.messageId?await ch.messages.fetch(cfg.dashboard.messageId).catch(()=>null):null;
  if(!msg)msg=await ch.send({content:"```\n"+dashboardText(guild)+"\n```"});
  updateGuildConfig(guild.id,{dashboard:{channelId:ch.id,messageId:msg.id}});
  await refresh(guild);
  return {channel:ch,message:msg};
}

function started(guild,snapshotCount=1){
  const s=getState(guild);
  s.startedAt=s.startedAt||Date.now();
  s.snapshots=Math.max(s.snapshots,snapshotCount);
  s.status="PROTECTED";
  s.threat="LOW";
}

function recordIncident(guild,severity,incident={}){
  const s=getState(guild);s.incidents++;
  if(severity===N.labels.critical)s.threat="CRITICAL";
  else if(severity===N.labels.high&&s.threat!=="CRITICAL")s.threat="HIGH";
  else if(severity===N.labels.medium&&s.threat==="LOW")s.threat="ELEVATED";
  s.latestIncident={title:incident.title||"Security event",severity,time:Date.now()};
  s.events.push({time:new Date().toLocaleTimeString(),text:(incident.title||"Security event")+" • "+severity});
  if(s.events.length>20)s.events.shift();
  void refresh(guild);
}

function recordLiveEvent(guild,text){const s=getState(guild);s.events.push({time:new Date().toLocaleTimeString(),text:String(text).slice(0,100)});if(s.events.length>20)s.events.shift();void refresh(guild);}

function recordBlocked(guild){
  const s=getState(guild);s.blocked++;s.threat=s.threat==="CRITICAL"?"CRITICAL":"ELEVATED";void refresh(guild);
}

function recordSnapshot(guild,snapshot){
  const s=getState(guild);s.snapshots++;s.latestSnapshot={time:snapshot?.time||Date.now()};recordLiveEvent(guild,"Automatic recovery snapshot captured");
}

function recoverThreat(guild){
  const s=getState(guild);
  if(s.threat!=="CRITICAL")s.threat="LOW";
  s.status="PROTECTED";
  void refresh(guild);
}

function startLiveTicker(client){
  setInterval(()=>{
    for(const guild of client.guilds.cache.values()){
      const cfg=getGuildConfig(guild.id);
      if(cfg.security?.initialized&&cfg.security?.enabled)void refresh(guild);
    }
  },15000).unref();
}

module.exports={ensureDashboard,started,recordIncident,recordLiveEvent,recordBlocked,recordSnapshot,recoverThreat,startLiveTicker};
