// Safe end-to-end security self-test. It generates synthetic events only; it never mutates Discord.
const { recordAndAssess }=require("../intelligence/slowAttack");
const { correlate }=require("../intelligence/correlation");
async function runSecurityStress(guildId){
 const start=Date.now();
 const vectors=["channelDelete","roleDelete","dangerousPermission","permissionOverwrite","webhookCreate","integration"];
 for(let i=0;i<6;i++) await recordAndAssess(guildId,{executorId:`synthetic-${i%2}`,actionType:vectors[i],targetId:`synthetic-target-${i}`});
 const assessment=correlate(guildId);
 return {ok:true,syntheticOnly:true,durationMs:Date.now()-start,coordinated:assessment.coordinated,strong:assessment.strong,eventCount:assessment.eventCount};
}
module.exports={runSecurityStress};
