const heat=new Map();
function addHeat(guildId,userId,amount=20,decayMs=10*60*1000){const key=guildId+":"+userId;const now=Date.now();const current=heat.get(key)||{value:0,time:now};const decayed=Math.max(0,current.value-Math.floor((now-current.time)/decayMs)*10);const value=Math.min(100,decayed+amount);heat.set(key,{value,time:now});return value;}
function getHeat(guildId,userId){return heat.get(guildId+":"+userId)?.value||0;}
module.exports={addHeat,getHeat};