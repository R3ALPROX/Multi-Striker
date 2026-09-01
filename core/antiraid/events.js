const { inspectJoin } = require("./detector");
const { inspectMember } = require("../memberSecurity/detector");
const { inspectBot } = require("../botSecurity/detector");
const { update } = require("../security/adaptiveLevel");
const { analyzeContext } = require("../ai/analyzer");
const { evaluateHeatPanic } = require("./heatPanic");
const { inspectJoinGate } = require("../joingate/filter");

function registerAntiRaidEvents(client) {
    client.on("guildMemberAdd", async member => {
        try {
            if (member.user.bot) {
                const bot = await inspectBot(member);
                update(member.guild.id, bot.risk);
                return;
            }
            const gate = await inspectJoinGate(member);
            const result = await inspectMember(member);
            update(member.guild.id, result.risk);
            await inspectJoin(member);
            await evaluateHeatPanic(member.guild);
        } catch (error) { console.error("Anti-raid event error:", error); }
    });
}
module.exports = { registerAntiRaidEvents };