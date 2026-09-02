const {SlashCommandBuilder,PermissionFlagsBits,ChannelType,EmbedBuilder,ButtonBuilder,ButtonStyle,ActionRowBuilder,MessageFlags}=require("discord.js");
const {getGuildConfig,updateGuildConfig}=require("../config/manager");
const {runSecurityAudit}=require("../core/security/audit");
const {takeSnapshot}=require("../core/backups/snapshot");

async function getOrCreateSecurityChannel(guild){
 const existing=guild.channels.cache.find(c=>c.type===ChannelType.GuildText&&c.name==="security-logs");
 if(existing)return existing;
 return guild.channels.create({name:"security-logs",type:ChannelType.GuildText,reason:"Multi Striker automatic security setup"});
}

async function getOrCreateVerification(guild,botMember){
 let role=guild.roles.cache.find(r=>r.name==="Verified");
 if(!role)role=await guild.roles.create({name:"Verified",permissions:[],reason:"Multi Striker verification system"});
 if(role.position>=botMember.roles.highest.position)throw new Error("Verified role must remain below Multi Striker.");
 let channel=guild.channels.cache.find(c=>c.type===ChannelType.GuildText&&c.name==="verification");
 if(!channel)channel=await guild.channels.create({name:"verification",type:ChannelType.GuildText,reason:"Multi Striker verification system"});
 return{role,channel};
}

module.exports={
 data:new SlashCommandBuilder()
  .setName("start")
  .setDescription("Automatically set up Multi Striker protection")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false),
 async execute(interaction){
  if(!interaction.inGuild())return interaction.reply({content:"Multi Striker can only be started inside a server.",flags:MessageFlags.Ephemeral});
  if(interaction.user.id!==interaction.guild.ownerId)return interaction.reply({content:"Only the server owner can start Multi Striker protection.",flags:MessageFlags.Ephemeral});
  await interaction.deferReply({flags:MessageFlags.Ephemeral});
  try{
   const guild=interaction.guild;
   const botMember=guild.members.me||await guild.members.fetch(interaction.client.user.id);
   if(!botMember)throw new Error("Could not resolve Multi Striker's guild member.");
   const required=[PermissionFlagsBits.ViewAuditLog,PermissionFlagsBits.ManageRoles,PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ModerateMembers,PermissionFlagsBits.ManageWebhooks];
   const missing=required.filter(p=>!botMember.permissions.has(p));
   if(missing.length){
    return interaction.editReply("Multi Striker is missing required permissions. Reinvite it with View Audit Log, Manage Roles, Manage Channels, Moderate Members and Manage Webhooks, then run /start again.");
   }

   const logChannel=await getOrCreateSecurityChannel(guild);
   const verification=await getOrCreateVerification(guild,botMember);
   updateGuildConfig(guild.id,{security:{enabled:true,alertChannelId:logChannel.id},antinuke:{enabled:true},antiraid:{enabled:true},joingate:{enabled:true},automod:{enabled:true},verification:{enabled:true,channelId:verification.channel.id,verifiedRoleId:verification.role.id},logs:{security:logChannel.id,raid:logChannel.id,verification:logChannel.id}});

   const snapshot=takeSnapshot(guild);
   let audit=null;
   try{audit=await runSecurityAudit(guild);}catch(error){console.error("Initial security audit error:",error);}

   const panel=new EmbedBuilder()
    .setTitle("🛡️ Multi Striker Verification")
    .setDescription("Normal members are not quarantined. Members that the security engine considers suspicious can be directed here for verification.")
    .setTimestamp();
   const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("multi_striker_verify").setLabel("Verify me").setStyle(ButtonStyle.Success));
   await verification.channel.send({embeds:[panel],components:[row]});

   const embed=new EmbedBuilder()
    .setTitle("🛡️ Multi Striker Protection Active")
    .setDescription("Automatic security is configured.")
    .addFields(
     {name:"Anti-Nuke",value:"Active",inline:true},
     {name:"Anti-Raid",value:"Active",inline:true},
     {name:"Adaptive Anti-Spam",value:"Active",inline:true},
     {name:"Security Logs",value:logChannel.toString(),inline:true},
     {name:"Verification",value:verification.channel.toString(),inline:true},
     {name:"Backup",value:`Snapshot **${snapshot.id}** created`,inline:true},
     {name:"Automatic response",value:"Contextual containment, panic lockdown, coordinated-actor detection and safe recovery are enabled."}
    ).setTimestamp();
   if(audit)embed.addFields({name:"Initial Security Scan",value:`Score: **${audit.score}/100** • ${audit.status}`});
   await logChannel.send({embeds:[embed]});
   await interaction.editReply("Multi Striker is fully configured. 🛡️ #security-logs, adaptive protection, backups, raid detection and suspicious-user verification are active.");
  }catch(error){
   console.error("/start setup failed:",error);
   const message=error?.message?String(error.message).slice(0,800):"Unknown error";
   await interaction.editReply(`Multi Striker could not finish setup.\n\n**Error:** ${message}`).catch(()=>{});
  }
 }
};