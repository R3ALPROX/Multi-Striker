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

async function containDestructiveBot(guild,member,result,reason){
 const administrator=result.dangerousPermissions?.includes("Administrator");
 const destructive=administrator||result.risk>=60;
 if(!destructive)return{attempted:false,stopped:false};
 // A quarantine role cannot override Administrator permissions. If a destructive bot
 // remains capable of acting, remove it from the server when Discord hierarchy allows it.
 if(!member.kickable)return{attempted:false,stopped:false,reason:"Bot is not kickable; its role is at or above Multi Striker."};
 const kicked=await member.kick(reason).then(()=>true).catch(()=>false);
 return{attempted:true,stopped:kicked,reason:kicked?"Destructive bot removed from server":"Discord rejected the kick"};
}

async function verifyBot(guild,member){
 if(!isQuarantined(guild.id,member.id))return{ok:false,held:true,reason:"Bot was not quarantined before verification."};
 const result=await inspectBot(member);
 const source=result.source?.provenance;
 const cfg=getGuildConfig(guild.id);
 const trusted=cfg.security?.trustedBotIds?.includes(member.id);
 const selfBot=member.id===guild.members.me?.id;

 // Multi Striker itself is the only bot allowed to auto-release. Other bots always
 // remain quarantined until the server owner explicitly approves them.
 if(!selfBot){
  const containment=await containDestructiveBot(guild,member,result,"Multi Striker detected a destructive bot during pre-action verification");
  await sendLog(guild,"verification",securityEmbed(containment.stopped?"DESTRUCTIVE BOT REMOVED":"BOT HELD IN QUARANTINE",`<@${member.id}> was evaluated before any release.`,[
   {name:"Risk",value:String(result.risk),inline:true},
   {name:"Dangerous permissions",value:String(result.dangerousPermissions?.length||0),inline:true},
   {name:"Containment",value:containment.stopped?"Kicked":"Quarantine retained",inline:true},
   {name:"Hierarchy",value:guild.members.me?`Target ${member.roles.highest.position} / Multi Striker ${guild.members.me.roles.highest.position}`:"Multi Striker member unavailable",inline:true},
   {name:"Reason",value:(containment.reason||result.reasons||["Owner approval required"]).toString().slice(0,1000)}
  ])).catch(()=>{});
  if(containment.stopped)return{ok:false,held:false,removed:true,result};
 }

 const sourcePass=selfBot||!!source?.verifiedBot||!!trusted;
 const permissionPass=selfBot||(!result.dangerousPermissions?.includes("Administrator")&&result.dangerousPermissions?.length<=3);
 const me=guild.members.me;
 const rolePass=selfBot||!!me?.roles?.highest&&member.roles.highest.position<me.roles.highest.position;
 const raidPass=!isRaidModeActive(guild.id);
 const riskPass=selfBot||result.risk<35;
 const passed=sourcePass&&permissionPass&&rolePass&&raidPass&&riskPass;
 if(!passed){
  const containment=await containDestructiveBot(guild,member,result,"Multi Striker destructive-bot containment after failed verification");
  await sendLog(guild,"verification",securityEmbed(containment.stopped?"DESTRUCTIVE BOT REMOVED":"BOT HELD IN QUARANTINE",`<@${member.id}> failed complete pre-action verification.`,[
   {name:"Multi Striker self identity",value:selfBot?"Yes":"No",inline:true},
   {name:"Discord verified",value:source?.verifiedBot?"Yes":"No",inline:true},
   {name:"Risk",value:String(result.risk),inline:true},
   {name:"Dangerous permissions",value:String(result.dangerousPermissions?.length||0),inline:true},
   {name:"Hierarchy",value:me?`Target ${member.roles.highest.position} / Multi Striker ${me.roles.highest.position}`:"Multi Striker member unavailable",inline:true},
   {name:"Containment",value:containment.stopped?"Kicked":(containment.reason||"Quarantine retained"),inline:true},
   {name:"Source",value:source?.addedBy?`Added by <@${source.addedBy}>`:"Installer unknown",inline:true},
   {name:"Reasons",value:(result.source?.reasons||result.reasons||["Verification failed"]).slice(0,5).join("; ").slice(0,1000)}
  ])).catch(()=>{});
  return{ok:false,held:!containment.stopped,result,containment};
 }

 const released=await releaseMemberRestricted(guild,member.id,"Multi Striker self verification restricted release");
 if(!released.ok)return{ok:false,held:true,reason:released.reason,result};
 await applyVerifiedRole(guild,member,"Multi Striker verified bot").catch(()=>{});
 if(released.withheld?.length){
  pendingPermissionRequests.set(guild.id+":"+member.id,{guildId:guild.id,memberId:member.id,roleIds:released.withheld,createdAt:Date.now()});
  const row=new ActionRowBuilder().addComponents(
   new ButtonBuilder().setCustomId(`ms_botperm_allow:${member.id}`).setLabel("Allow moderation permissions").setStyle(ButtonStyle.Danger),
   new ButtonBuilder().setCustomId(`ms_botperm_deny:${member.id}`).setLabel("Keep restricted").setStyle(ButtonStyle.Secondary)
  );
  await sendLog(guild,"verification",{embeds:[securityEmbed("BOT VERIFIED — OWNER PERMISSION REQUIRED",`<@${member.id}> passed verification and was released with basic roles only. Privileged roles remain withheld until the server owner explicitly approves them.`,[
   {name:"Risk",value:String(result.risk),inline:true},
   {name:"Source",value:"Multi Striker self identity",inline:true},
   {name:"Withheld roles",value:String(released.withheld.length),inline:true}
  ])],components:[row]}).catch(()=>{});
 }else{
  await sendLog(guild,"verification",securityEmbed("BOT VERIFIED AND RESTRICTED RELEASE",`<@${member.id}> passed complete verification and was released with no moderation-capable roles restored.`,[
   {name:"Risk",value:String(result.risk),inline:true},
   {name:"Source",value:"Multi Striker self identity",inline:true}
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
 if(!member){pendingPermissionRequests.delete(key);await interaction.reply({content:"The bot is no longer in the server.",ephemeral:true}).catch(()=>{});return true;}
 if(action==="allow"){
  const released=await releaseMember(interaction.guild,member.id,"Server owner approved full quarantine release",interaction.user.id);
  if(!released.ok){await interaction.reply({content:`Full release failed: ${released.reason}`,ephemeral:true}).catch(()=>{});return true;}
  pendingPermissionRequests.delete(key);
  await interaction.update({content:`Owner approved full release for <@${member.id}>. Restored ${released.restored} previously backed-up role(s).`,embeds:[],components:[]}).catch(()=>{});
  await sendLog(interaction.guild,"verification",securityEmbed("BOT FULL RELEASE APPROVED",`The server owner approved restoration of the bot's backed-up roles for <@${member.id}>.`)).catch(()=>{});
 }else{
  pendingPermissionRequests.delete(key);
  await interaction.update({content:`<@${member.id}> remains restricted. Privileged roles stay withheld.`,embeds:[],components:[]}).catch(()=>{});
  await sendLog(interaction.guild,"verification",securityEmbed("BOT KEPT RESTRICTED",`The server owner denied restoration of privileged roles for <@${member.id}>.`)).catch(()=>{});
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