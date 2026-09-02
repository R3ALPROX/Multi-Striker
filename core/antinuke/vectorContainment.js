const { containMember }=require("./actions");
const { quarantineMember }=require("../quarantine/manager");
const { triggerPanic }=require("../panic/manager");
const { takeSnapshot }=require("../backups/snapshot");
async function containVector(guild,executorId,reason,meta={}){
 takeSnapshot(guild);
 const containment=await containMember(guild,executorId,reason).catch(e=>({ok:false,message:e.message}));
 const quarantine=await quarantineMember(guild,executorId,reason).catch(e=>({ok:false,message:e.message}));
 if(meta.critical) await triggerPanic(guild,reason,{executorId,...meta});
 return{containment,quarantine};
}
module.exports={containVector};