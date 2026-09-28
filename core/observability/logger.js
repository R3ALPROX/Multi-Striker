const {N}=require("../identity/registry");
const {formatForLog}=require("./forensics");
const {recordLiveEvent}=require("./dashboard");
function incidentEmbed(i){return null;}
async function sendLog(guild,incident){
  incident.forensicFields=incident.forensicFields||formatForLog(guild,incident,incident.action||"automatic security response");
  recordLiveEvent(guild,(incident.title||"Security event")+" • "+(incident.severity||N.labels.medium));
  return true;
}
module.exports={incidentEmbed,sendLog};