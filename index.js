require("dotenv").config();

const fs = require("fs");
const path = require("path");
const {
    Client,
    Collection,
    GatewayIntentBits,
    Partials,
    REST,
    Routes
} = require("discord.js");

const { registerAntiNukeEvents } = require("./core/antinuke/events");
const { registerAntiRaidEvents } = require("./core/antiraid/events");
const { registerVerificationEvents } = require("./core/verification/events");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration
    ],
    partials: [Partials.GuildMember]
});

client.commands = new Collection();

function loadCommands() {
    const commandsPath = path.join(__dirname, "commands");
    const payload = [];

    for (const file of fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"))) {
        try {
            const command = require(path.join(commandsPath, file));
            if (!command.data || !command.execute) {
                console.warn(`Invalid command file: ${file}`);
                continue;
            }
            client.commands.set(command.data.name, command);
            payload.push(command.data.toJSON());
            console.log(`Loaded command: /${command.data.name}`);
        } catch (error) {
            console.error(`Failed to load ${file}:`, error);
        }
    }

    return payload;
}

const commandPayload = loadCommands();

async function registerCommands() {
    const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commandPayload }
    );
    console.log(`Registered ${commandPayload.length} global slash commands.`);
}

client.once("clientReady", () => {
    console.log("================================");
    console.log("MULTI STRIKER IS ONLINE");
    console.log(`Bot: ${client.user.tag}`);
    console.log(`Servers: ${client.guilds.cache.size}`);
    console.log(`Commands: ${client.commands.size}`);
    console.log("================================");
});

client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`Command error /${interaction.commandName}:`, error);
        const payload = { content: "An error occurred while running this command.", ephemeral: true };
        if (interaction.replied || interaction.deferred) await interaction.followUp(payload);
        else await interaction.reply(payload);
    }
});

async function start() {
    if (!process.env.DISCORD_TOKEN) throw new Error("DISCORD_TOKEN is missing.");
    if (!process.env.CLIENT_ID) throw new Error("CLIENT_ID is missing.");

    await registerCommands();
    registerAntiNukeEvents(client);
    registerAntiRaidEvents(client);
    registerVerificationEvents(client);
    await client.login(process.env.DISCORD_TOKEN);
}

start().catch(error => {
    console.error("FAILED TO START MULTI STRIKER:", error);
    process.exit(1);
});
