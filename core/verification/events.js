const {applyVerifiedRole,verifyBot,handleBotPermissionInteraction}=require("./service");
const {getGuildConfig}=require("../../config/manager");
const {inspectMember}=require("../memberSecurity/detector");
const {isRaidModeActive}=require("../antiraid/raidMode");
const {quarantineMember}=require("../quarantine/manager");
const {sendLog,securityEmbed}=require("../security/logger");

function registerVerificationEvents(client){
 client.on("guildMemberAdd",async member=>{
  try{
   const cfg=getGuildConfig(member.guild.id);
   if(!cfg.verification.enabled||!cfg.verification.verifiedRoleId)return;

   if(member.user.bot){
    // Hard rule: quarantine BEFORE trust or release. If Discord hierarchy prevents
    // quarantine, perform a read-only risk inspection and attempt emergency removal
    // only when the bot is clearly destructive and kickable.
    const quarantined=await quarantineMember(member.guild,member.id,"Multi Striker bot pre-verification quarantine");
    if(!quarantined.ok){
     const {inspectBot}=require("../botSecurity/detector");
     const result=await inspectBot(member).catch(()=>null);
     const destructive=!!result&&(result.dangerousPermissions?.includes("Administrator")||result.risk>=60);
     let kicked=false;
     if(destructive&&member.kickable)kicked=await member.kick("Multi Striker emergency containment: destructive bot could not be quarantined").then(()=>true).catch(()=>false);
     await sendLog(member.guild,"verification",securityEmbed(kicked?"DESTRUCTIVE BOT REMOVED":"BOT QUARANTINE INCOMPLETE",`<@${member.id}> could not be placed into a confirmed quarantine state.`,[
      {name:"Reason",value:String(quarantined.reason||"Unknown failure").slice(0,1000)},
      {name:"Risk",value:result?String(result.risk):"Unavailable",inline:true},
      {name:"Dangerous permissions",value:result?String(result.dangerousPermissions?.length||0):"Unavailable",inline:true},
      {name:"Emergency containment",value:kicked?"Kicked":"Not possible / not required",inline:true},
      {name:"Hierarchy",value:member.guild.members.me?`Target ${member.roles.highest.position} / Multi Striker ${member.guild.members.me.roles.highest.position}`:"Multi Striker member unavailable",inline:true},
      {name:"Backup created",value:quarantined.backupCreated?"Yes":"No",inline:true}
     ])).catch(()=>{});
     return;
    }
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