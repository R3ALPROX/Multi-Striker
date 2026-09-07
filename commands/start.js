const {SlashCommandBuilder,PermissionFlagsBits,ChannelType,EmbedBuilder}=require("discord.js");
const {updateGuildConfig}=require("../config/manager");
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
 data:new SlashCommandBuilder().setName("start").setDescription("Automatically set up Multi Striker protection").setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
 async execute(interaction){
  try{
   if(!interaction.guildId||!interaction.guild)return interaction.reply({content:"Multi Striker can only be started inside a server.",ephemeral:true});
   if(interaction.user.id!==interaction.guild.ownerId)return interaction.reply({content:"Only the server owner can start Multi Striker protection.",ephemeral:true});
   await interaction.deferReply({ephemeral:true});
   const guild=interaction.guild;
   const botMember=guild.members.me||await guild.members.fetch(interaction.client.user.id);
   if(!botMember)throw new Error("Could not resolve Multi Striker's guild member.");
   const highestManagedRole=guild.roles.cache.filter(r=>!r.managed&&r.id!==guild.id).sort((a,b)=>b.position-a.position).first();
   if(highestManagedRole&&highestManagedRole.id!==botMember.roles.highest.id)throw new Error("Multi Striker must have the highest non-managed role in the server. Move its role to the top before running /start so newly added bots can be quarantined before verification.");
   const required=[PermissionFlagsBits.ViewAuditLog,PermissionFlagsBits.ManageRoles,PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ModerateMembers,PermissionFlagsBits.ManageWebhooks];
   const missing=required.filter(p=>!botMember.permissions.has(p));
   if(missing.length)return interaction.editReply("Multi Striker is missing required permissions. Reinvite it with View Audit Log, Manage Roles, Manage Channels, Moderate Members and Manage Webhooks, then run /start again.");
   const logChannel=await getOrCreateSecurityChannel(guild);
   const verification=await getOrCreateVerification(guild,botMember);
   updateGuildConfig(guild.id,{security:{enabled:true,alertChannelId:logChannel.id},antinuke:{enabled:true},antiraid:{enabled:true},joingate:{enabled:true,containDangerousBots:true},automod:{enabled:true},verification:{enabled:true,channelId:verification.channel.id,verifiedRoleId:verification.role.id},logs:{security:logChannel.id,raid:logChannel.id,verification:logChannel.id}});
   const snapshot=takeSnapshot(guild);
   let audit=null;
   try{audit=await runSecurityAudit(guild);}catch(error){console.error("Initial security audit error:",error);}
   const embed=new EmbedBuilder().setTitle("🛡️ Multi Striker Protection Active").setDescription("Automatic security is configured. Members are verified in the background; every bot is quarantined first and must pass provenance, permission, hierarchy and risk checks before release.").addFields(
    {name:"Anti-Nuke",value:"Active",inline:true},
    {name:"Anti-Raid",value:"Active",inline:true},
    {name:"Adaptive Anti-Spam",value:"Active",inline:true},
    {name:"Security Logs",value:logChannel.toString(),inline:true},
    {name:"Verification",value:"Automatic",inline:true},
    {name:"Bot Gate",value:"Quarantine → Source → Risk → Release (restricted)",inline:true},
    {name:"Backup",value:`Snapshot **${snapshot.id}** created`,inline:true},
    {name:"Automatic response",value:"Contextual containment, panic lockdown, coordinated-actor detection, bot pre-action quarantine and safe recovery are enabled."}
   ).setTimestamp();
   if(audit)embed.addFields({name:"Initial Security Scan",value:`Score: **${audit.score}/100** • ${audit.status}`});
   await logChannel.send({embeds:[embed]});
   await interaction.editReply("Multi Striker is fully configured. 🛡️ Every newly added bot is quarantined before complete verification; verified bots are released without moderation permissions and the server owner must explicitly approve any withheld moderation roles.");
  }catch(error){
   console.error("/start setup failed:",error);
   const message=error?.message?String(error.message).slice(0,800):"Unknown error";
   if(interaction.deferred||interaction.replied)await interaction.editReply(`Multi Striker could not finish setup.\n\n**Error:** ${message}`).catch(()=>{});
   else await interaction.reply({content:`Multi Striker could not start.\n\n**Error:** ${message}`,ephemeral:true}).catch(()=>{});
  }
 }
};
