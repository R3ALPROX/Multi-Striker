require("dotenv").config();

const fs = require("fs");
const {
    Client,
    Collection,
    GatewayIntentBits,
    REST,
    Routes
} = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();

const commands = [];

const commandFiles = fs.readdirSync("./commands").filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
}

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log("Registering slash commands...");

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );

        console.log("✅ Slash commands registered!");
    } catch (err) {
        console.error(err);
    }
})();

client.once("ready", () => {
    console.log(`✅ ${client.user.tag} is online.`);
});

client.on("interactionCreate", async interaction => {

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (err) {
        console.error(err);

        await interaction.reply({
            content: "❌ An error occurred while executing this command.",
            ephemeral: true
        });
    }

});

client.login(process.env.TOKEN);  try {

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
