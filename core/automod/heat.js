const heat=new Map();
function addHeat(guildId,userId,amount=20,decayPerSecond=1){const key=guildId+":"+userId,now=Date.now(),current=heat.get(key)||{value:0,time:now};const decayed=Math.max(0,current.value-((now-current.time)/1000)*decayPerSecond);const value=Math.min(100,decayed+amount);heat.set(key,{value,time:now});return value;}
function getHeat(guildId,userId){return heat.get(guildId+":"+userId)?.value||0;}
function resetHeat(guildId,userId){heat.delete(guildId+":"+userId);}
module.exports={addHeat,getHeat,resetHeat};