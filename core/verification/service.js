const {getGuildConfig}=require("../../config/manager");
const {isRaidModeActive}=require("../antiraid/raidMode");
const {sendLog,securityEmbed}=require("../security/logger");
const {inspectBot}=require("../botSecurity/detector");
const {releaseMember,isQuarantined}=require("../quarantine/manager");

async function applyVerifiedRole(guild,member,reason="Multi Striker automatic verification"){
 const config=getGuildConfig(guild.id);
 if(!config.verification.enabled||!config.verification.verifiedRoleId)return{ok:false,reason:"Verification is not configured."};
 const verifiedRole=guild.roles.cache.get(config.verification.verifiedRoleId);
 if(!verifiedRole)return{ok:false,reason:"Verified role no longer exists."};
 if(!verifiedRole.editable)return{ok:false,reason:"Verified role is above Multi Striker."};
 if(!member.roles.cache.has(verifiedRole.id))await member.roles.add(verifiedRole,reason);
 if(config.verification.unverifiedRoleId){
  const unverified=guild.roles.cache.get(config.verification.unverifiedRoleId);
  if(unverified?.editable&&member.roles.cache.has(unverified.id))await member.roles.remove(unverified,"Multi Striker verification completed");
 }
 return{ok:true,roleId:verifiedRole.id};
}

async function verifyBot(guild,member){
 // The bot must already be quarantined. Verification never happens first.
 if(!isQuarantined(guild.id,member.id))return{ok:false,held:true,reason:"Bot was not quarantined before verification."};
 const result=await inspectBot(member);
 const source=result.source?.provenance;
 const cfg=getGuildConfig(guild.id);
 const trusted=cfg.security?.trustedBotIds?.includes(member.id);
 const sourcePass=!!source?.verifiedBot||!!trusted;
 const permissionPass=!result.dangerousPermissions?.includes("Administrator")&&result.dangerousPermissions?.length<=3;
 const rolePass=member.roles.highest?.position<=(guild.members.me?.roles.highest?.position||0);
 const raidPass=!isRaidModeActive(guild.id);
 const riskPass=result.risk<35;
 const passed=sourcePass&&permissionPass&&rolePass&&raidPass&&riskPass;
 if(!passed){
  await sendLog(guild,"verification",securityEmbed("BOT HELD IN QUARANTINE",`<@${member.id}> did not pass complete pre-action verification.`,[
   {name:"Discord verified",value:source?.verifiedBot?"Yes":"No",inline:true},
   {name:"Risk",value:String(result.risk),inline:true},
   {name:"Dangerous permissions",value:String(result.dangerousPermissions?.length||0),inline:true},
   {name:"Source",value:source?.addedBy?`Added by <@${source.addedBy}>`:"Installer unknown",inline:true},
   {name:"Reasons",value:(result.source?.reasons||result.reasons||["Verification failed"]).slice(0,5).join("; ").slice(0,1000)}
  ])).catch(()=>{});
  return{ok:false,held:true,result};
 }
 const released=await releaseMember(guild,member.id,"Multi Striker complete bot verification passed");
 if(!released.ok)return{ok:false,held:true,reason:released.reason,result};
 await applyVerifiedRole(guild,member,"Multi Striker verified bot").catch(()=>{});
 await sendLog(guild,"verification",securityEmbed("BOT VERIFIED AND RELEASED",`<@${member.id}> passed pre-action verification and was released from quarantine.`,[
  {name:"Discord verified",value:"Yes",inline:true},
  {name:"Risk",value:String(result.risk),inline:true},
  {name:"Source",value:source?.addedBy?`Added by <@${source.addedBy}>`:"Unknown",inline:true}
 ])).catch(()=>{});
 return{ok:true,result};
}

async function verifyMember(interaction){
 if(!interaction.guild||!interaction.member)throw new Error("Verification can only be used in a server.");
 const member=await interaction.guild.members.fetch(interaction.user.id);
 const result=await applyVerifiedRole(interaction.guild,member,"Multi Striker verification");
 if(!result.ok)return{ok:false,message:result.reason};
 await sendLog(interaction.guild,"verification",securityEmbed("Member verified",`<@${member.id}> completed verification.`,[{name:"Raid mode active",value:isRaidModeActive(interaction.guild.id)?"Yes":"No",inline:true}])).catch(()=>{});
 return{ok:true,message:"Verification complete."};
}
module.exports={verifyMember,applyVerifiedRole,verifyBot};
