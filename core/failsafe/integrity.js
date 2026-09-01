const { enterLockdown } = require("./failsafe");

function checkSecurityConfig(guildId, config) {
    if (!config || !config.security || !config.antinuke || !config.antiraid) {
        enterLockdown(guildId, "Critical security configuration integrity failure");
        return false;
    }
    return true;
}

module.exports = { checkSecurityConfig };