const {SlashCommandBuilder,PermissionFlagsBits,ChannelType,EmbedBuilder,MessageFlags}=require("discord.js");
const {updateGuildConfig}=require("../config/manager");
const {getIdentity}=require("../config/identity");
const {runSecurityAudit}=require("../core/security/audit");
const {takeSnapshot}=require("../core/backups/snapshot");

const identity=getIdentity();
const BOT_NAME=identity.bot.name;
const F=identity.features;

async function getOrCreateSecurityChannel(guild){
 const existing=guild.channels.cache.find(c=>c.type===ChannelType.GuildText&&c.name==="security-logs");
 if(existing)return existing;
 return guild.channels.create({name:"security-logs",type:ChannelType.GuildText,reason:`${BOT_NAME} automatic security setup`});
}

async function getOrCreateVerification(guild,botMember){
 let role=guild.roles.cache.find(r=>r.name==="Verified");
 if(!role)role=await guild.roles.create({name:"Verified",permissions:[],reason:`${BOT_NAME} verification system`});
 if(role.position>=botMember.roles.highest.position)throw new Error("Verified role must remain below the bot's highest role.");
 let channel=guild.channels.cache.find(c=>c.type===ChannelType.GuildText&&c.name==="verification");
 if(!channel)channel=await guild.channels.create({name:"verification",type:ChannelType.GuildText,reason:`${BOT_NAME} verification system`});
 return{role,channel};
}

module.exports={
 data:new SlashCommandBuilder().setName("start").setDescription(`Automatically set up ${BOT_NAME} protection`).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
 async execute(interaction){
  try{
   if(!interaction.guildId||!interaction.guild)return interaction.reply({content:`${BOT_NAME} can only be started inside a server.`,flags:MessageFlags.Ephemeral});
   if(interaction.user.id!==interaction.guild.ownerId)return interaction.reply({content:`Only the server owner can start ${BOT_NAME} protection.`,flags:MessageFlags.Ephemeral});
   await interaction.deferReply({flags:MessageFlags.Ephemeral});
   const guild=interaction.guild;
   const botMember=guild.members.me||await guild.members.fetch(interaction.client.user.id);
   if(!botMember)throw new Error(`Could not resolve ${BOT_NAME}'s guild member.`);

   // A bot's highest role may itself be Discord-managed. The previous check compared
   // that managed role's ID with the highest *non-managed* role ID, which can never
   // match and incorrectly rejected a correctly positioned Multi Striker.
   const highestManagedRole=guild.roles.cache
    .filter(r=>!r.managed&&r.id!==guild.id)
    .sort((a,b)=>b.position-a.position)
    .first();
   if(highestManagedRole&&botMember.roles.highest.position<highestManagedRole.position){
    throw new Error(`${BOT_NAME} must have a role at or above the highest non-managed role. Move its highest role to the top before running /start.`);
   }

   const required=[PermissionFlagsBits.ViewAuditLog,PermissionFlagsBits.ManageRoles,PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ModerateMembers,PermissionFlagsBits.ManageWebhooks];
   const missing=required.filter(p=>!botMember.permissions.has(p));
   if(missing.length)return interaction.editReply(`${BOT_NAME} is missing required permissions. Reinvite it with View Audit Log, Manage Roles, Manage Channels, Moderate Members and Manage Webhooks, then run /start again.`);
   const logChannel=await getOrCreateSecurityChannel(guild);
   const verification=await getOrCreateVerification(guild,botMember);
   updateGuildConfig(guild.id,{identity,security:{enabled:true,alertChannelId:logChannel.id},antinuke:{enabled:true},antiraid:{enabled:true},joingate:{enabled:true,containDangerousBots:true},automod:{enabled:true},verification:{enabled:true,channelId:verification.channel.id,verifiedRoleId:verification.role.id},logs:{security:logChannel.id,raid:logChannel.id,verification:logChannel.id}});
   const snapshot=takeSnapshot(guild);
   let audit=null;
   try{audit=await runSecurityAudit(guild);}catch(error){console.error("Initial security audit error:",error);}
   const embed=new EmbedBuilder().setTitle(`🛡️ ${BOT_NAME} Protection Active`).setDescription(`Automatic security is configured. Members are verified in the background; every bot is quarantined first and must pass provenance, permission, hierarchy and risk checks before release.`).addFields(
    {name:F.antiNuke,value:"Active",inline:true},
    {name:F.antiRaid,value:"Active",inline:true},
    {name:F.adaptiveAntiSpam,value:"Active",inline:true},
    {name:"Security Logs",value:logChannel.toString(),inline:true},
    {name:F.verification,value:"Automatic",inline:true},
    {name:F.botGate,value:"Quarantine → Source → Risk → Release (restricted)",inline:true},
    {name:F.backups,value:`Snapshot **${snapshot.id}** created`,inline:true},
    {name:"Automatic response",value:"Contextual containment, panic lockdown, coordinated-actor detection, bot pre-action quarantine and safe recovery are enabled."}
   ).setTimestamp();
   if(audit)embed.addFields({name:"Initial Security Scan",value:`Score: **${audit.score}/100** • ${audit.status}`});
   await logChannel.send({embeds:[embed]});
   await interaction.editReply(`${BOT_NAME} is fully configured. 🛡️ Newly added bots are quarantined before complete verification; withheld moderation access requires owner approval.`);
  }catch(error){
   console.error("/start setup failed:",error);
   const message=error?.message?String(error.message).slice(0,800):"Unknown error";
   if(interaction.deferred||interaction.replied)await interaction.editReply(`${BOT_NAME} could not finish setup.\n\n**Error:** ${message}`).catch(()=>{});
   else await interaction.reply({content:`${BOT_NAME} could not start.\n\n**Error:** ${message}`,flags:MessageFlags.Ephemeral}).catch(()=>{});
  }
 }
};
