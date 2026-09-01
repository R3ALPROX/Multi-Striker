const { inspectJoin } = require("./detector");
const { inspectMember } = require("../memberSecurity/detector");
const { inspectBot } = require("../botSecurity/detector");
const { update } = require("../security/adaptiveLevel");
const { analyzeContext } = require("../ai/analyzer");

function registerAntiRaidEvents(client) {
    client.on("guildMemberAdd", async member => {
        try {
            if (member.user.bot) {
                const bot = await inspectBot(member);
                update(member.guild.id, bot.risk);
                return;
            }
            const result = await inspectMember(member);
            update(member.guild.id, result.risk);
            await inspectJoin(member);
        } catch (error) { console.error("Anti-raid event error:", error); }
    });
}
module.exports = { registerAntiRaidEvents };