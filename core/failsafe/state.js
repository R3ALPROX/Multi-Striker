const states = new Map();

function getState(guildId) {
    return states.get(guildId) || { mode: "NORMAL", since: Date.now(), reason: null };
}

function setState(guildId, mode, reason = null) {
    const state = { mode, since: Date.now(), reason };
    states.set(guildId, state);
    return state;
}

function isActionAllowed(guildId) {
    const mode = getState(guildId).mode;
    return mode === "NORMAL" || mode === "SAFE_MODE";
}

module.exports = { getState, setState, isActionAllowed };