const fs = require("node:fs");
const path = require("node:path");
const { createProfile, observeUser, observeGuild, observeLeave, addIncident } = require("./profile");

const DATA_DIR = path.join(__dirname, "../../data");
const DATA_FILE = path.join(DATA_DIR, "identity-profiles.json");
const profiles = new Map();
let loaded = false;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    for (const [id, profile] of Object.entries(parsed)) profiles.set(id, profile);
  } catch (error) {
    if (error.code !== "ENOENT") console.error("Identity profile load failed:", error.message);
  }
}

function persist() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const payload = Object.fromEntries(profiles);
  const temp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(payload, null, 2), "utf8");
  fs.renameSync(temp, DATA_FILE);
}

function get(userId) {
  load();
  return profiles.get(String(userId)) || null;
}

function upsertUser(user) {
  load();
  const id = String(user.id);
  let profile = profiles.get(id);
  if (!profile) profile = createProfile(user);
  else observeUser(profile, user);
  profiles.set(id, profile);
  persist();
  return profile;
}

function memberJoin(member) {
  const profile = upsertUser(member.user);
  observeGuild(profile, member);
  persist();
  return profile;
}

function memberUpdate(member) {
  const profile = upsertUser(member.user);
  observeGuild(profile, member);
  persist();
  return profile;
}

function memberLeave(user, guild) {
  const profile = upsertUser(user);
  observeLeave(profile, guild);
  persist();
  return profile;
}

function recordIncident(user, incident) {
  const profile = upsertUser(user);
  addIncident(profile, incident);
  persist();
  return profile;
}

function recordBan(user, guild, reason, source = "local") {
  return recordIncident(user, {
    type: "ban_observed",
    guildId: String(guild.id),
    guildName: guild.name ?? null,
    reason: reason ?? null,
    sourceId: source
  });
}

function list(limit = 100) {
  load();
  return [...profiles.values()].slice(-Math.max(1, Number(limit) || 100));
}

module.exports = {
  DATA_FILE,
  get,
  upsertUser,
  memberJoin,
  memberUpdate,
  memberLeave,
  recordIncident,
  recordBan,
  list
};
