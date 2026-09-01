const incidents = new Map();
function add(guildId,event){const list=incidents.get(guildId)||[];list.push({time:Date.now(),...event});while(list.length>1000)list.shift();incidents.set(guildId,list);}
function recent(guildId,ms=300000){const now=Date.now();return (incidents.get(guildId)||[]).filter(e=>now-e.time<=ms);}
module.exports={add,recent};