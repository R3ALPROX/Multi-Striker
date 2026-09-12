const {getGuildConfig}=require("../config/store");const states=new Map();const joins=new Map();
function state(g){return states.get(g.id)||{panic:false,raid:false,until:0,reason:null};}
function setPanic(guild,on,reason){const s=state(guild);s.panic=on;s.reason=reason||null;s.until=on?Date.now()+15*60*1000:0;states.set(guild.id,s);return s;}
function setRaid(guild,on,reason){const s=state(guild);s.raid=on;s.reason=reason||null;s.until=on?Date.now()+10*60*1000:0;states.set(guild.id,s);return s;}
function recordJoin(guild){const cfg=getGuildConfig(guild.id);const now=Date.now();const a=joins.get(guild.id)||[];a.push(now);const fresh=a.filter(t=>now-t<=cfg.security.raidWindowMs);joins.set(guild.id,fresh);if(fresh.length>=cfg.security.raidJoinLimit&&!state(guild).raid)setRaid(guild,true,"join velocity threshold exceeded");return fresh.length;}
function tick(guild){const s=state(guild);if(s.until&&Date.now()>s.until){s.panic=false;s.raid=false;s.until=0;states.set(guild.id,s);}return s;}
function isPanic(g){return tick(g).panic}function isRaid(g){return tick(g).raid}
module.exports={state,setPanic,setRaid,recordJoin,tick,isPanic,isRaid};