require("dotenv").config();
const fs=require("node:fs");
const path=require("node:path");
const {Client,GatewayIntentBits,Partials}=require("discord.js");
const {N}=require("./core/identity/registry");
const {loadConfig}=require("./core/config/store");
const {registerSecurityEvents}=require("./core/security/events");
const {loadProfiles}=require("./core/identity/store");
const {startLiveTicker}=require("./core/observability/dashboard");
const {snapshotGuild}=require("./core/recovery/snapshot");
const {getGuildConfig}=require("./core/config/store");
const {recordSnapshot}=require("./core/observability/dashboard");
const {sendLog}=require("./core/observability/logger");
const readline=require("node:readline");
const commandsDir=path.join(__dirname,"commands");
const commands=[];
const startCommand=require(path.join(commandsDir,"start.js"));
if(startCommand.data&&startCommand.execute)commands.push(startCommand);
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildModeration,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent],partials:[Partials.Channel]});
loadConfig();loadProfiles();
client.once("clientReady",async()=>{console.log(`${N.product.name} online | ${client.user.tag} | ${client.guilds.cache.size} guilds`);for(const guild of client.guilds.cache.values())await registerCommands(guild).catch(console.error);});
client.on("guildCreate",guild=>registerCommands(guild).catch(console.error));
client.on("interactionCreate",async i=>{if(!i.isChatInputCommand())return;const c=commands.find(x=>x.data.name===i.commandName);if(!c)return;try{await c.execute(i,client);}catch(e){console.error(e);if(!i.replied&&!i.deferred)await i.reply({content:"Security system command failed safely.",ephemeral:true}).catch(()=>{});}});
async function registerCommands(guild){await guild.commands.set(commands.map(c=>c.data));}
registerSecurityEvents(client);
startLiveTicker(client);
setInterval(()=>{for(const guild of client.guilds.cache.values()){const cfg=getGuildConfig(guild.id);if(!cfg.security?.initialized||!cfg.security?.enabled)continue;const s=snapshotGuild(guild);if(s){recordSnapshot(guild,s);}}},5*60*1000).unref();
if(!process.env.DISCORD_TOKEN)throw new Error("DISCORD_TOKEN is required");
client.login(process.env.DISCORD_TOKEN);

const consoleInterface=readline.createInterface({input:process.stdin,output:process.stdout,prompt:"VORHEX> "});
consoleInterface.on("line",async input=>{
  const parts=input.trim().split(/\\s+/);
  const command=(parts.shift()||"").toLowerCase();
  if(command==="leave"){
    const guildId=parts[0];
    if(!guildId){
      console.log("Usage: leave <guild_id>");
      consoleInterface.prompt();
      return;
    }
    if(!/^\\d{17,20}$/.test(guildId)){
      console.log("Invalid Discord guild ID.");
      consoleInterface.prompt();
      return;
    }
    const guild=client.guilds.cache.get(guildId)||await client.guilds.fetch(guildId).catch(()=>null);
    if(!guild){
      console.log("Guild not found or VORHEX is not a member.");
      consoleInterface.prompt();
      return;
    }
    const name=guild.name;
    try{
      await guild.leave();
      console.log(`Left guild: ${name} (${guildId})`);
    }catch(error){
      console.error(`Failed to leave ${guildId}: ${error.message}`);
    }
    consoleInterface.prompt();
    return;
  }
  if(command==="help"){
    console.log("leave <guild_id>  Leave one selected Discord server.");
    consoleInterface.prompt();
    return;
  }
  if(command)console.log("Unknown console command. Use: help");
  consoleInterface.prompt();
});
consoleInterface.on("close",()=>process.exit(0));
consoleInterface.prompt();