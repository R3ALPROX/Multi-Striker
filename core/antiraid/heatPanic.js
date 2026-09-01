const { recent }=require("../intelligence/memory");
const { triggerPanic }=require("../panic/manager");
const { update }=require("../security/adaptiveLevel");
async function evaluateHeatPanic(guild){
 const joins=recent(guild.id,30000).filter(e=>e.type==="member_join");
 const risky=joins.filter(e=>(e.risk||0)>=35);
 if(joins.length>=20 && risky.length>=10){
   update(guild.id,90);
   return triggerPanic(guild,"Coordinated high-risk join burst",{joins:joins.length,risky:risky.length});
 }
 return null;
}
module.exports={evaluateHeatPanic};