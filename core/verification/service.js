const {ActionRowBuilder,ButtonBuilder,ButtonStyle}=require("discord.js");
const {getGuildConfig}=require("../../config/manager");
const {isRaidModeActive}=require("../antiraid/raidMode");
const {sendLog,securityEmbed}=require("../security/logger");
const {inspectBot}=require("../botSecurity/detector");
const {releaseMember,releaseMemberRestricted,isQuarantined}=require("../quarantine/manager");

const pendingPermissionRequests=new Map();

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
  await sendLog(guild,"verification",securityEmbed("BOT HELD IN QUARANTINE",`<@${member.id}> failed complete pre-action verification.`,[
   {name:"Discord verified",value:source?.verifiedBot?"Yes":"No",inline:true},
   {name:"Risk",value:String(result.risk),inline:true},
   {name:"Dangerous permissions",value:String(result.dangerousPermissions?.length||0),inline:true},
   {name:"Source",value:source?.addedBy?`Added by <@${source.addedBy}>`:"Installer unknown",inline:true},
   {name:"Reasons",value:(result.source?.reasons||result.reasons||["Verification failed"]).slice(0,5).join("; ").slice(0,1000)}
  ])).catch(()=>{});
  return{ok:false,held:true,result};
 }

 // Release only after verification, but NEVER restore moderation-capable roles automatically.
 const released=await releaseMemberRestricted(guild,member.id,"Multi Striker complete bot verification passed");
 if(!released.ok)return{ok:false,held:true,reason:released.reason,result};
 await applyVerifiedRole(guild,member,"Multi Striker verified bot").catch(()=>{});

 if(released.withheld?.length){
  pendingPermissionRequests.set(guild.id+":"+member.id,{guildId:guild.id,memberId:member.id,roleIds:released.withheld,createdAt:Date.now()});
  const row=new ActionRowBuilder().addComponents(
   new ButtonBuilder().setCustomId(`ms_botperm_allow:${member.id}`).setLabel("Allow moderation permissions").setStyle(ButtonStyle.Danger),
   new ButtonBuilder().setCustomId(`ms_botperm_deny:${member.id}`).setLabel("Keep restricted").setStyle(ButtonStyle.Secondary)
  );
  await sendLog(guild,"verification",{embeds:[securityEmbed("BOT VERIFIED — OWNER PERMISSION REQUIRED",`<@${member.id}> passed verification and was released **without its moderation roles**. The server owner must explicitly approve restoration of those roles.`,[
   {name:"Risk",value:String(result.risk),inline:true},
   {name:"Source",value:source?.verifiedBot?"Discord Verified Bot":"Trusted bot allowlist",inline:true},
   {name:"Withheld roles",value:String(released.withheld.length),inline:true}
  ])],components:[row]}).catch(()=>{});
 }else{
  await sendLog(guild,"verification",securityEmbed("BOT VERIFIED AND RELEASED",`<@${member.id}> passed complete verification and was released with no moderation-capable roles restored.`,[
   {name:"Risk",value:String(result.risk),inline:true},
   {name:"Source",value:source?.verifiedBot?"Discord Verified Bot":"Trusted bot allowlist",inline:true}
  ])).catch(()=>{});
 }
 return{ok:true,result,withheld:released.withheld||[]};
}

async function handleBotPermissionInteraction(interaction){
 if(!interaction.isButton()||!interaction.customId.startsWith("ms_botperm_"))return false;
 if(!interaction.guild)return true;
 if(interaction.user.id!==interaction.guild.ownerId){await interaction.reply({content:"Only the server owner can approve moderation permissions for a verified bot.",ephemeral:true}).catch(()=>{});return true;}
 const parts=interaction.customId.split(":");
 const action=parts[0].replace("ms_botperm_","");
 const memberId=parts[1];
 const key=interaction.guild.id+":"+memberId;
 const request=pendingPermissionRequests.get(key);
 if(!request){await interaction.reply({content:"This permission request has expired or was already handled.",ephemeral:true}).catch(()=>{});return true;}
 const member=await interaction.guild.members.fetch(memberId).catch(()=>null);
 if(!member){pendingPermissionRequests.delete(key);await interaction.reply({content:"The bot is no longer in this server.",ephemeral:true}).catch(()=>{});return true;}
 if(action==="allow"){
  const roles=request.roleIds.map(id=>interaction.guild.roles.cache.get(id)).filter(role=>role?.editable);
  for(const role of roles)await member.roles.add(role,"Server owner approved Multi Striker bot moderation permissions").catch(()=>{});
  pendingPermissionRequests.delete(key);
  await interaction.update({content:`Owner approved moderation permissions for <@${member.id}>. Restored ${roles.length} previously withheld role(s).`,embeds:[],components:[]}).catch(()=>{});
  await sendLog(interaction.guild,"verification",securityEmbed("BOT MODERATION PERMISSIONS APPROVED",`The server owner approved moderation permissions for <@${member.id}>.`)).catch(()=>{});
 }else{
  pendingPermissionRequests.delete(key);
  await interaction.update({content:`<@${member.id}> remains restricted. No moderation roles were restored.`,embeds:[],components:[]}).catch(()=>{});
  await sendLog(interaction.guild,"verification",securityEmbed("BOT KEPT RESTRICTED",`The server owner denied moderation permissions for <@${member.id}>.`)).catch(()=>{});
 }
 return true;
}

async function verifyMember(interaction){
 if(!interaction.guild||!interaction.member)throw new Error("Verification can only be used in a server.");
 const member=await interaction.guild.members.fetch(interaction.user.id);
 const result=await applyVerifiedRole(interaction.guild,member,"Multi Striker verification");
 if(!result.ok)return{ok:false,message:result.reason};
 await sendLog(interaction.guild,"verification",securityEmbed("Member verified",`<@${member.id}> completed verification.`,[{name:"Raid mode active",value:isRaidModeActive(interaction.guild.id)?"Yes":"No",inline:true}])).catch(()=>{});
 return{ok:true,message:"Verification complete."};
}
module.exports={verifyMember,applyVerifiedRole,verifyBot,handleBotPermissionInteraction};
