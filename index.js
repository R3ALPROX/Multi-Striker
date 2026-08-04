require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});


const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong!"),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Shows information about this server")
].map(command => command.toJSON());


const rest = new REST({ version: "10" })
  .setToken(process.env.TOKEN);


// Register global slash commands
(async () => {
  try {

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      {
        body: commands
      }
    );

    console.log("Global slash commands registered.");

  } catch (error) {

    console.error(error);

  }
})();


client.once("ready", () => {

  console.log(`Logged in as ${client.user.tag}`);

});


client.on("interactionCreate", async interaction => {

  if (!interaction.isChatInputCommand()) return;


  if (interaction.commandName === "ping") {

    return interaction.reply("🏓 Pong!");

  }


  if (interaction.commandName === "serverinfo") {

    const embed = new EmbedBuilder()
      .setTitle(interaction.guild.name)
      .addFields(
        {
          name: "👥 Members",
          value: `${interaction.guild.memberCount}`,
          inline: true
        },
        {
          name: "📁 Channels",
          value: `${interaction.guild.channels.cache.size}`,
          inline: true
        }
      )
      .setColor(0x5865F2);


    return interaction.reply({
      embeds: [embed]
    });

  }

});


client.login(process.env.TOKEN);