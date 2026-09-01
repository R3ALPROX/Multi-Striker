const { getState, setState } = require("./state");
const { getGuildConfig } = require("../../config/manager");

const failureWindows = new Map();

function recordFailure(guildId, source, error) {
    const now = Date.now();
    const entries = failureWindows.get(guildId) || [];
    const recent = entries.filter(x => now - x.time < 60_000);
    recent.push({ time: now, source, message: String(error?.message || error) });
    failureWindows.set(guildId, recent);

    if (recent.length >= 8) {
        enterSafeMode(guildId, "Repeated internal failures detected");
    }
}

function enterSafeMode(guildId, reason) {
    const current = getState(guildId);
    if (current.mode === "LOCKDOWN" || current.mode === "EMERGENCY_SHUTDOWN") return current;
    return setState(guildId, "SAFE_MODE", reason);
}

function enterLockdown(guildId, reason) {
    return setState(guildId, "LOCKDOWN", reason);
}

function emergencyShutdown(guildId, reason) {
    return setState(guildId, "EMERGENCY_SHUTDOWN", reason);
}

function recover(guildId) {
    return setState(guildId, "NORMAL", "Owner-authorized recovery");
}

async function notifyOwner(guild, state) {
    try {
        const owner = await guild.fetchOwner();
        await owner.send(
            "🚨 **Multi Striker Fail-Safe Activated**\n" +
            "Server: **" + guild.name + "**\n" +
            "Mode: **" + state.mode + "**\n" +
            "Reason: " + (state.reason || "Unknown") +
            "\n\nAutomated destructive actions are disabled until recovery."
        );
    } catch (_) {
        // Owner DMs may be closed. Logging systems continue independently.
    }
}

async function trigger(guild, mode, reason) {
    let state;
    if (mode === "SAFE_MODE") state = enterSafeMode(guild.id, reason);
    else if (mode === "LOCKDOWN") state = enterLockdown(guild.id, reason);
    else state = emergencyShutdown(guild.id, reason);

    await notifyOwner(guild, state);
    return state;
}

module.exports = {
    recordFailure,
    enterSafeMode,
    enterLockdown,
    emergencyShutdown,
    recover,
    trigger,
    getState
};