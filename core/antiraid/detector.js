const { getGuildConfig } = require("../../config/manager");
const { activateRaidMode, isRaidModeActive } = require("./raidMode");
const { sendLog, securityEmbed } = require("../security/logger");

const joins = new Map();

function addJoin(guildId, windowMs) {
    const now = Date.now();
    const list = (joins.get(guildId) || []).filter(time => now - time <= windowMs);
    list.push(now);
    joins.set(guildId, list);
    return list.length;
}

async function inspectJoin(member) {
    const guild = member.guild;
    const config = getGuildConfig(guild.id);
    if (!config.antiraid.enabled) return;

    const windowMs = config.antiraid.windowSeconds * 1000;
    const count = addJoin(guild.id, windowMs);

    if (config.antiraid.minimumAccountAgeDays > 0) {
        const ageMs = Date.now() - member.user.createdTimestamp;
        const minimumMs = config.antiraid.minimumAccountAgeDays * 86400000;
        if (ageMs < minimumMs) {
            await sendLog(guild, "raid", securityEmbed(
                "Young account detected",
                `<@${member.id}> joined with an account younger than the configured minimum.`,
                [{ name: "Account age", value: `${Math.floor(ageMs / 3600000)} hours` }]
            ));
        }
    }

    if (count < config.antiraid.joinThreshold || isRaidModeActive(guild.id)) return;

    const until = activateRaidMode(guild.id, config.antiraid.raidModeMinutes);

    await sendLog(guild, "raid", securityEmbed(
        "RAID MODE ACTIVATED",
        "Join activity exceeded the configured threshold. New-member verification remains available, but the server should be reviewed immediately.",
        [
            { name: "Joins detected", value: String(count), inline: true },
            { name: "Window", value: `${config.antiraid.windowSeconds}s`, inline: true },
            { name: "Raid mode until", value: `<t:${Math.floor(until / 1000)}:R>`, inline: true }
        ]
    ));
}

module.exports = { inspectJoin };
