const { enterSafeMode } = require("./failsafe");

function validateAIResult(result) {
    if (!result || typeof result !== "object") {
        return { valid: false, reason: "AI returned invalid data" };
    }

    if (typeof result.risk !== "number" || result.risk < 0 || result.risk > 100) {
        return { valid: false, reason: "AI risk score outside allowed range" };
    }

    const allowed = ["MONITOR", "VERIFY", "ALERT", "CONTAIN"];
    if (result.action && !allowed.includes(result.action)) {
        return { valid: false, reason: "AI attempted an unsupported action" };
    }

    return { valid: true };
}

function guardAIResult(guildId, result) {
    const check = validateAIResult(result);
    if (!check.valid) {
        enterSafeMode(guildId, "AI integrity guard: " + check.reason);
        return { allowed: false, reason: check.reason };
    }
    return { allowed: true };
}

module.exports = { validateAIResult, guardAIResult };