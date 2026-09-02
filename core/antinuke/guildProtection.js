const {processSecurityAction}=require("./detector");
async function inspectGuildUpdate(entry,guild){const vanity=entry.changes?.some(c=>["vanity_url_code","vanity_url_code_hash"].includes(c.key));if(vanity)await processSecurityAction(guild,entry.executorId,"dangerousPermission",entry.targetId);}
module.exports={inspectGuildUpdate};
