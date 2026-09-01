const states = new Map();

function activateRaidMode(guildId, minutes) {
    const until = Date.now() + minutes * 60 * 1000;
    states.set(guildId, until);
    return until;
}

function deactivateRaidMode(guildId) {
    states.delete(guildId);
}

function isRaidModeActive(guildId) {
    const until = states.get(guildId);
    if (!until) return false;
    if (Date.now() >= until) {
        states.delete(guildId);
        return false;
    }
    return true;
}

function getRaidModeUntil(guildId) {
    return isRaidModeActive(guildId) ? states.get(guildId) : null;
}

module.exports = {
    activateRaidMode,
    deactivateRaidMode,
    isRaidModeActive,
    getRaidModeUntil
};
