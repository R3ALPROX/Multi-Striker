const levels=new Map();
function update(guildId,risk){const level=risk>=80?"UNDER_ATTACK":risk>=60?"THREATENED":risk>=35?"ELEVATED":"NORMAL";levels.set(guildId,{level,risk,time:Date.now()});return levels.get(guildId);}
function get(guildId){return levels.get(guildId)||{level:"NORMAL",risk:0};}
module.exports={update,get};