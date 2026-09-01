const { getSnapshot }=require("./snapshot");
// Deliberately dry-run by default: restoration must be owner-approved by a future command.
function buildRestorePlan(guildId){
 const snapshot=getSnapshot(guildId);
 if(!snapshot)return null;
 return {
   takenAt:snapshot.takenAt,
   rolesToReview:snapshot.roles?.length||0,
   channelsToReview:snapshot.channels?.length||0,
   mode:"OWNER_APPROVAL_REQUIRED"
 };
}
module.exports={buildRestorePlan};