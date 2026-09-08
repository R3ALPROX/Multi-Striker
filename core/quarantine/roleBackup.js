const fs = require("node:fs");
const path = require("node:path");

const DATA_DIR = path.join(__dirname, "../../data");
const DATA_FILE = path.join(DATA_DIR, "quarantine-role-backups.json");
const backups = new Map();
let loaded = false;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    for (const [key, value] of Object.entries(JSON.parse(raw))) backups.set(key, value);
  } catch (error) {
    if (error.code !== "ENOENT") console.error("Quarantine backup load failed:", error.message);
  }
}

function persist() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(backups), null, 2), "utf8");
  fs.renameSync(tmp, DATA_FILE);
}

function key(guildId, memberId) { return `${guildId}:${memberId}`; }

function create(guild, member, reason) {
  load();
  const record = {
    schemaVersion: 1,
    state: "pending",
    guildId: String(guild.id),
    guildName: guild.name ?? null,
    memberId: String(member.id),
    createdAt: Date.now(),
    reason: String(reason || "Security containment"),
    roles: [...member.roles.cache.values()]
      .filter(role => role.id !== guild.id)
      .map(role => ({ id: role.id, name: role.name, position: role.position, managed: role.managed }))
  };
  backups.set(key(guild.id, member.id), record);
  persist();
  return record;
}

function markQuarantined(guildId, memberId, quarantineRoleId) {
  load();
  const record = backups.get(key(guildId, memberId));
  if (!record) return null;
  record.state = "quarantined";
  record.quarantineRoleId = String(quarantineRoleId);
  record.quarantinedAt = Date.now();
  persist();
  return record;
}

function markRestricted(guildId, memberId) {
  load();
  const record = backups.get(key(guildId, memberId));
  if (!record) return null;
  record.state = "restricted";
  record.restrictedAt = Date.now();
  persist();
  return record;
}

function get(guildId, memberId) {
  load();
  return backups.get(key(guildId, memberId)) || null;
}

function remove(guildId, memberId) {
  load();
  backups.delete(key(guildId, memberId));
  persist();
}

module.exports = { DATA_FILE, create, markQuarantined, markRestricted, get, remove };
