const { inspectJoin } = require("./detector");

function registerAntiRaidEvents(client) {
    client.on("guildMemberAdd", async member => {
        try {
            await inspectJoin(member);
        } catch (error) {
            console.error("Anti-raid event error:", error);
        }
    });
}

module.exports = { registerAntiRaidEvents };
