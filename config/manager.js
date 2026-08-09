const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const CONFIG_FILE = path.join(DATA_DIR, "guilds.json");

// Make sure data/ exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Make sure configuration file exists
if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, "{}");
}

function loadConfigs() {
    try {
        return JSON.parse(
            fs.readFileSync(CONFIG_FILE, "utf8")
        );
    } catch (error) {
        console.error("❌ Failed to load guild configuration:", error);
        return {};
    }
}

function saveConfigs(configs) {
    try {
        // Write atomically to reduce corruption risk.
        const temporaryFile = `${CONFIG_FILE}.tmp`;

        fs.writeFileSync(
            temporaryFile,
            JSON.stringify(configs, null, 2)
        );

        fs.renameSync(temporaryFile, CONFIG_FILE);
    } catch (error) {
        console.error("❌ Failed to save guild configuration:", error);
        throw error;
    }
}

function getGuildConfig(guildId) {
    const configs = loadConfigs();

    if (!configs[guildId]) {
        configs[guildId] = {
            security: {
                dangerousActionRoleId: null,
                notificationRoleId: null
            },

            logs: {
                moderation: null,
                channels: null,
                roles: null,
                members: null,
                messages: null,
                voice: null,
                bot: null,
                temporaryChannels: null,
                security: null,
                backups: null
            },

            temporaryChannels: {
                categoryId: null,
                enabled: true
            },

            ai: {
                enabled: false,
                timeoutEnabled: true
            }
        };

        saveConfigs(configs);
    }

    return configs[guildId];
}

function updateGuildConfig(guildId, updates) {
    const configs = loadConfigs();

    if (!configs[guildId]) {
        getGuildConfig(guildId);
        return updateGuildConfig(guildId, updates);
    }

    configs[guildId] = deepMerge(
        configs[guildId],
        updates
    );

    saveConfigs(configs);

    return configs[guildId];
}

function deepMerge(target, source) {
    for (const key of Object.keys(source)) {

        if (
            source[key] &&
            typeof source[key] === "object" &&
            !Array.isArray(source[key])
        ) {
            if (!target[key] || typeof target[key] !== "object") {
                target[key] = {};
            }

            deepMerge(target[key], source[key]);

        } else {
            target[key] = source[key];
        }
    }

    return target;
}

module.exports = {
    getGuildConfig,
    updateGuildConfig
};