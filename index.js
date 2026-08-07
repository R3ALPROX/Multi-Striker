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

// Load commands
const commandFiles = fs
    .readdirSync("./commands")
    .filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);

    if (!command.data || !command.execute) {
        console.log(`⚠️ Invalid command file: ${file}`);
        continue;
    }

    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());

    console.log(`Loaded command: /${command.data.name}`);
}

// Register global slash commands
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

async function registerCommands() {
    try {
        console.log("🔄 Registering global slash commands...");

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            {
                body: commands
            }
        );

        console.log("✅ Global slash commands registered!");
    } catch (error) {
        console.error("❌ Failed to register slash commands:");
        console.error(error);
    }
}

client.once("ready", () => {
    console.log(`✅ ${client.user.tag} is online!`);
    console.log(`📊 Servers: ${client.guilds.cache.size}`);
    console.log(`⚡ Commands loaded: ${client.commands.size}`);
});

// Handle slash commands
client.on("interactionCreate", async interaction => {

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.log(`❌ Unknown command: ${interaction.commandName}`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(
            `❌ Error executing /${interaction.commandName}:`,
            error
        );

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: "❌ Something went wrong while executing this command.",
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: "❌ Something went wrong while executing this command.",
                ephemeral: true
            });
        }
    }
});

// Start bot
async function startBot() {
    try {
        if (!process.env.TOKEN) {
            throw new Error("TOKEN is missing from environment variables.");
        }

        if (!process.env.CLIENT_ID) {
            throw new Error("CLIENT_ID is missing from environment variables.");
        }

        await registerCommands();

        await client.login(process.env.TOKEN);

    } catch (error) {
        console.error("❌ Failed to start Multi Striker:");
        console.error(error);
        process.exit(1);
    }
}

startBot();