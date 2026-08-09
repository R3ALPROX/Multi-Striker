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

// ================================
// LOAD COMMANDS
// ================================

const commandFiles = fs
    .readdirSync("./commands")
    .filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    try {
        const command = require(`./commands/${file}`);

        if (!command.data || !command.execute) {
            console.log(`⚠️ Invalid command file: ${file}`);
            continue;
        }

        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());

        console.log(`✅ Loaded command: /${command.data.name}`);
    } catch (error) {
        console.error(`❌ Failed to load ${file}:`, error);
    }
}

// ================================
// DISCORD REST API
// ================================

const rest = new REST({ version: "10" })
    .setToken(process.env.DISCORD_TOKEN);

// ================================
// REGISTER GLOBAL SLASH COMMANDS
// ================================

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

// ================================
// BOT READY
// ================================

client.once("ready", () => {
    console.log("");
    console.log("================================");
    console.log("🚀 MULTI STRIKER IS ONLINE");
    console.log("================================");
    console.log(`🤖 Bot: ${client.user.tag}`);
    console.log(`📊 Servers: ${client.guilds.cache.size}`);
    console.log(`⚡ Commands: ${client.commands.size}`);
    console.log("================================");
});

// ================================
// SLASH COMMAND HANDLER
// ================================

client.on("interactionCreate", async interaction => {

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.log(
            `❌ Unknown command: /${interaction.commandName}`
        );
        return;
    }

    try {

        await command.execute(interaction);

    } catch (error) {

        console.error(
            `❌ Error executing /${interaction.commandName}:`,
            error
        );

        try {

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

        } catch (replyError) {
            console.error(
                "❌ Could not send error message:",
                replyError
            );
        }
    }
});

// ================================
// START BOT
// ================================

async function startBot() {

    try {

        // Check Discord token
        if (!process.env.DISCORD_TOKEN) {
            throw new Error(
                "DISCORD_TOKEN is missing from environment variables."
            );
        }

        // Check Application ID
        if (!process.env.CLIENT_ID) {
            throw new Error(
                "CLIENT_ID is missing from environment variables."
            );
        }

        console.log("🔐 Environment variables detected.");

        // Register slash commands
        await registerCommands();

        // Login
        console.log("🔄 Connecting to Discord...");

        await client.login(process.env.DISCORD_TOKEN);

    } catch (error) {

        console.error("");
        console.error("❌ FAILED TO START MULTI STRIKER");
        console.error("--------------------------------");
        console.error(error);
        console.error("--------------------------------");

        process.exit(1);
    }
}

// ================================
// START
// ================================

startBot();