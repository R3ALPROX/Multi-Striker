require("dotenv").config();
const fs=require("fs");
const path=require("path");
const {Client,Collection,GatewayIntentBits,Partials,REST,Routes,AuditLogEvent}=require("discord.js");
const {registerAntiNukeEvents}=require("./core/antinuke/events");const {registerAntiRaidEvents}=require("./core/antiraid/events");const {registerVerificationEvents}=require("./core/verification/events");const {inspectMessage}=require("./core/automod/messages");const {recordFailure}=require("./core/failsafe/failsafe");const {startBackupScheduler}=require("./core/backups/scheduler");const {inspectRolePermissionChange}=require("./core/antinuke/strictPermissions");const {startHealthMonitor}=require("./core/failsafe/health");const {registerIdentityEvents}=require("./core/identity/events");
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildModeration,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent],partials:[Partials.GuildMember,Partials.Channel,Partials.Message]});client.commands=new Collection();
function loadCommands(){
 const commandsPath=path.join(__dirname,"commands");
 const files=fs.readdirSync(commandsPath).filter(file=>file.endsWith(".js"));
 const payload=[];
 for(const file of files){
  try{
   const command=require(path.join(commandsPath,file));
   if(!command?.data?.name||typeof command.execute!=="function"){console.warn(`Skipped invalid command module: ${file}`);continue;}
   client.commands.set(command.data.name,command);
   payload.push(command.data.toJSON());
   console.log(`Loaded command: /${command.data.name}`);
  }catch(error){console.error(`Failed to load command module ${file}:`,error);}
 }
 return payload;
}
const commandPayload=loadCommands();
async function registerGuildCommands(guildId){
 const rest=new REST({version:"10"}).setToken(process.env.DISCORD_TOKEN);
 await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID,guildId),{body:commandPayload});
 console.log(`Registered ${commandPayload.length} slash commands to guild ${guildId}.`);
}
async function registerCommands(){
 const configuredGuildId=process.env.DEV_GUILD_ID;
 if(configuredGuildId){
  if(!/^\d{17,20}$/.test(configuredGuildId))throw new Error("DEV_GUILD_ID must be a valid Discord server ID.");
  try{await registerGuildCommands(configuredGuildId);}catch(error){if(error?.code===50001||error?.status===403){console.error("DEV_GUILD_ID is inaccessible. Continuing without guild command registration.");return;}throw error;}
  return;
 }
 for(const guild of client.guilds.cache.values()){
  try{await registerGuildCommands(guild.id);}catch(error){console.error(`Could not register commands to ${guild.name} (${guild.id}):`,error.message);}
 }
}
client.on("guildCreate",guild=>registerGuildCommands(guild.id).catch(error=>console.error(`Could not register commands to new guild ${guild.name} (${guild.id}):`,error.message)));
client.once("clientReady",()=>{console.log("MULTI STRIKER IS ONLINE | "+client.user.tag+" | "+client.guilds.cache.size+" servers");});
client.on("interactionCreate",async interaction=>{if(!interaction.isChatInputCommand())return;const command=client.commands.get(interaction.commandName);if(!command)return;try{await command.execute(interaction);}catch(error){console.error("Command error:",error);if(interaction.guildId)recordFailure(interaction.guildId,"command",error);const message=error?.message?String(error.message).slice(0,800):"Unknown error";const p={content:`Command failed.\n\n**Error:** ${message}`,ephemeral:true};if(interaction.replied||interaction.deferred)await interaction.followUp(p).catch(()=>{});else await interaction.reply(p).catch(()=>{});}});
client.on("messageCreate",message=>inspectMessage(message).catch(error=>{if(message.guild)recordFailure(message.guild.id,"automod",error);}));
async function start(){if(!process.env.DISCORD_TOKEN)throw new Error("DISCORD_TOKEN is missing.");if(!process.env.CLIENT_ID)throw new Error("CLIENT_ID is missing.");await client.login(process.env.DISCORD_TOKEN);await registerCommands();registerIdentityEvents(client);registerAntiNukeEvents(client);registerAntiRaidEvents(client);registerVerificationEvents(client);startBackupScheduler(client);startHealthMonitor(client);client.on("guildAuditLogEntryCreate",async(entry,guild)=>{try{if(entry.action===AuditLogEvent.RoleUpdate)await inspectRolePermissionChange(entry,guild);}catch(error){recordFailure(guild.id,"strict-permissions",error);}});}
start().catch(error=>{console.error("FAILED TO START MULTI STRIKER:",error);process.exit(1);});
