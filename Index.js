require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong!"),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Shows information about this server")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log("Slash commands registered.");
  } catch (err) {
    console.error(err);
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
    return interaction.reply({
      embeds: [
        {
          title: interaction.guild.name,
          fields: [
            {
              name: "Members",
              value: `${interaction.guild.memberCount}`,
              inline: true
            },
            {
              name: "Channels",
              value: `${interaction.guild.channels.cache.size}`,
              inline: true
            }
          ],
          color: 0x5865F2
        }
      ]
    });
  }
});

client.login(process.env.TOKEN);
