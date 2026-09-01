const { assess }=require("../intelligence/threatEngine");
const { recent,add }=require("../intelligence/memory");
async function inspectBotAction(guild,executorId,action){const prior=recent(guild.id,30000).filter(x=>x.executorId===executorId&&x.type==="bot_action");add(guild.id,{type:"bot_action",executorId,action});const signals=[{weight:action.includes("Delete")?30:10,reason:"Privileged bot action"}];if(prior.length>=3)signals.push({weight:35,reason:"Rapid repeated privileged actions"});return assess(signals);}
module.exports={inspectBotAction};