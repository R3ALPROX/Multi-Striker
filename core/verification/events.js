const {applyVerifiedRole,verifyBot,handleBotPermissionInteraction}=require("./service");
const {getGuildConfig}=require("../../config/manager");
const {inspectMember}=require("../memberSecurity/detector");
const {isRaidModeActive}=require("../antiraid/raidMode");
const {quarantineMember}=require("../quarantine/manager");

function registerVerificationEvents(client){
 client.on("guildMemberAdd",async member=>{
  try{
   const cfg=getGuildConfig(member.guild.id);
   if(!cfg.verification.enabled||!cfg.verification.verifiedRoleId)return;

   if(member.user.bot){
    // Hard rule: quarantine BEFORE any trust, release, or permission decision.
    const quarantined=await quarantineMember(member.guild,member.id,"Multi Striker bot pre-verification quarantine");
    if(!quarantined.ok)return;
    await verifyBot(member.guild,member);
    return;
   }

   const result=await inspectMember(member);
   const risk=result?.risk||0;
   const suspicious=risk>=35||isRaidModeActive(member.guild.id);
   if(suspicious)return;
   await applyVerifiedRole(member.guild,member);
   console.log(`Multi Striker automatically verified ${member.user.tag} in ${member.guild.name}`);
  }catch(error){console.error("Automatic verification error:",error);}
 });

 client.on("interactionCreate",async interaction=>{
  try{
   if(await handleBotPermissionInteraction(interaction))return;
  }catch(error){console.error("Bot permission approval error:",error);}
 });
}
module.exports={registerVerificationEvents};
