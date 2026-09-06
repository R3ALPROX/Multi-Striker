const {applyVerifiedRole}=require("./service");
const {getGuildConfig}=require("../../config/manager");
const {inspectMember}=require("../memberSecurity/detector");
const {inspectBot}=require("../botSecurity/detector");
const {isRaidModeActive}=require("../antiraid/raidMode");
const {quarantineMember}=require("../quarantine/manager");

function registerVerificationEvents(client){
 client.on("guildMemberAdd",async member=>{
  try{
   const cfg=getGuildConfig(member.guild.id);
   if(!cfg.verification.enabled||!cfg.verification.verifiedRoleId)return;
   const result=member.user.bot?await inspectBot(member):await inspectMember(member);
   const risk=result?.risk||0;
   // Normal/safe members are verified automatically. No button or user action is required.
   // During raid mode or when risk is elevated, leave the member unverified and contain only when the security engine warrants it.
   const suspicious=risk>=35||isRaidModeActive(member.guild.id);
   if(suspicious){
    if(member.user.bot&&risk>=60) await quarantineMember(member.guild,member.id,"Multi Striker automatic suspicious-bot containment").catch(()=>{});
    return;
   }
   const applied=await applyVerifiedRole(member.guild,member);
   if(applied.ok) console.log(`Multi Striker automatically verified ${member.user.tag} in ${member.guild.name}`);
  }catch(error){console.error("Automatic verification error:",error);}
 });

 client.on("interactionCreate",async interaction=>{
  if(!interaction.isButton()||interaction.customId!=="multi_striker_verify")return;
  try{
   const {verifyMember}=require("./service");
   const result=await verifyMember(interaction);
   await interaction.reply({content:result.message,ephemeral:true});
  }catch(error){
   console.error("Verification error:",error);
   if(!interaction.replied)await interaction.reply({content:"Verification failed. Ask a server administrator to check the bot's role hierarchy.",ephemeral:true});
  }
 });
}
module.exports={registerVerificationEvents};
