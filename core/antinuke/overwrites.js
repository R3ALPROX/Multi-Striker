const { processSecurityAction }=require("./detector");
async function inspectOverwriteChange(entry,guild){
 const suspicious=entry.changes?.some(c=>String(c.key||"").includes("permission_overwrites"));
 if(!suspicious) return;
 await processSecurityAction(guild,entry.executorId,"permissionOverwrite",entry.targetId);
}
module.exports={inspectOverwriteChange};