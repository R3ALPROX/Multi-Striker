const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const CONFIG_FILE = path.join(DATA_DIR, "guilds.json");

const DEFAULT_CONFIG = {
    security: {
        enabled: true,
        alertChannelId: null,
        trustedUserIds: [],
        trustedRoleIds: [],
        action: "strip_roles",
        cooldownSeconds: 30
    },
    antinuke: {
        enabled: true,
        windowSeconds: 15,
        thresholds: {
            channelDelete: 3,
            channelCreate: 5,
            roleDelete: 3,
            roleCreate: 5,
            roleUpdate: 5,
            ban: 4,
            kick: 4,
            webhookCreate: 3
        }
    },
    antiraid: {
        enabled: true,
        joinThreshold: 10,
        windowSeconds: 20,
        raidModeMinutes: 10,
        minimumAccountAgeDays: 0
    },
    joingate: { enabled: true, minimumAccountAgeMinutes: 0, requireAvatar: false, inviteInProfile: false },
    automod: { enabled: true, heatThreshold: 100 },
    backups: { enabled: true, intervalHours: 3 },
    verification: {
        enabled: false,
        channelId: null,
        verifiedRoleId: null,
        unverifiedRoleId: null
    },
    logs: {
        security: null,
        raid: null,
        verification: null
    }
};

function ensureStorage() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(CONFIG_FILE)) fs.writeFileSync(CONFIG_FILE, "{}");
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function deepMerge(target, source) {
    for (const key of Object.keys(source || {})) {
        const value = source[key];
        if (value && typeof value === "object" && !Array.isArray(value)) {
            if (!target[key] || typeof target[key] !== "object" || Array.isArray(target[key])) {
                target[key] = {};
            }
            deepMerge(target[key], value);
        } else {
            target[key] = value;
        }
    }
    return target;
}

function loadConfigs() {
    ensureStorage();
    try {
        const raw = fs.readFileSync(CONFIG_FILE, "utf8").trim();
        return raw ? JSON.parse(raw) : {};
    } catch (error) {
        console.error("Failed to load guild configuration:", error);
        return {};
    }
}

function saveConfigs(configs) {
    ensureStorage();
    const temporaryFile = `${CONFIG_FILE}.tmp`;
    fs.writeFileSync(temporaryFile, JSON.stringify(configs, null, 2));
    fs.renameSync(temporaryFile, CONFIG_FILE);
}

function getGuildConfig(guildId) {
    const configs = loadConfigs();
    const current = configs[guildId] || {};
    const merged = deepMerge(clone(DEFAULT_CONFIG), current);

    if (JSON.stringify(current) !== JSON.stringify(merged)) {
        configs[guildId] = merged;
        saveConfigs(configs);
    }

    return merged;
}

function updateGuildConfig(guildId, updates) {
    const configs = loadConfigs();
    const current = deepMerge(clone(DEFAULT_CONFIG), configs[guildId] || {});
    configs[guildId] = deepMerge(current, updates);
    saveConfigs(configs);
    return configs[guildId];
}

function resetGuildConfig(guildId) {
    const configs = loadConfigs();
    configs[guildId] = clone(DEFAULT_CONFIG);
    saveConfigs(configs);
    return configs[guildId];
}

module.exports = {
    DEFAULT_CONFIG,
    getGuildConfig,
    updateGuildConfig,
    resetGuildConfig
};
