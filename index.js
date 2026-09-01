require("dotenv").config();

const path = require("path");
const { Client, Collection, GatewayIntentBits, Partials, REST, Routes } = require("discord.js");

const { registerAntiNukeEvents } = require("./core/antinuke/events");
const { registerAntiRaidEvents } = require("./core/antiraid/events");
const { registerVerificationEvents } = require("./core/verification/events");
const { recordFailure } = require("./core/failsafe/failsafe");

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildModeration],
    partials: [Partials.GuildMember]
});

client.commands = new Collection();

function loadCommands() {
    const command = require(path.join(__dirname, "commands", "start.js"));
    client.commands.set(command.data.name, command);
    console.log("Loaded command: /start");
    return [command.data.toJSON()];
}

const commandPayload = loadCommands();

async function registerCommands() {
    const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
    const route = process.env.DEV_GUILD_ID
        ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.DEV_GUILD_ID)
        : Routes.applicationCommands(process.env.CLIENT_ID);

    await rest.put(route, { body: commandPayload });
    console.log(process.env.DEV_GUILD_ID ? "Registered /start in development server." : "Registered /start globally.");
}

client.once("clientReady", () => {
    console.log("================================");
    console.log("MULTI STRIKER IS ONLINE");
    console.log("Bot: " + client.user.tag);
    console.log("Servers: " + client.guilds.cache.size);
    console.log("Command: /start");
    console.log("================================");
});

client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error("Command error /" + interaction.commandName + ":", error);
        if (interaction.guild) recordFailure(interaction.guild.id, "command:" + interaction.commandName, error);
        const payload = { content: "An error occurred while running this command.", ephemeral: true };
        if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
        else await interaction.reply(payload).catch(() => {});
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