const DISCORD_EPOCH = 1420070400000;

const MAX_HISTORY = 20;
const MAX_GUILDS = 100;
const MAX_INCIDENTS = 50;

function accountCreatedAtFromId(id) {
  try {
    const snowflake = BigInt(String(id));
    if (snowflake <= 0n) return null;
    return Number((snowflake >> 22n) + BigInt(DISCORD_EPOCH));
  } catch {
    return null;
  }
}

function pushUniqueHistory(list, value) {
  if (value === null || value === undefined || value === "") return;
  if (list.length && list[list.length - 1].value === value) return;
  list.push({ value, observedAt: Date.now() });
  while (list.length > MAX_HISTORY) list.shift();
}

function snapshotUser(user) {
  if (!user) return null;
  return {
    id: String(user.id),
    username: user.username ?? null,
    globalName: user.globalName ?? null,
    avatar: user.avatar ?? null,
    bot: Boolean(user.bot),
    accountCreatedAt: accountCreatedAtFromId(user.id)
  };
}

function createProfile(user) {
  const snapshot = snapshotUser(user);
  const now = Date.now();
  return {
    schemaVersion: 1,
    subjectId: snapshot.id,
    type: snapshot.bot ? "bot" : "user",
    firstSeenAt: now,
    lastSeenAt: now,
    accountCreatedAt: snapshot.accountCreatedAt,
    current: {
      username: snapshot.username,
      globalName: snapshot.globalName,
      avatar: snapshot.avatar
    },
    history: {
      usernames: snapshot.username ? [{ value: snapshot.username, observedAt: now }] : [],
      globalNames: snapshot.globalName ? [{ value: snapshot.globalName, observedAt: now }] : [],
      avatars: snapshot.avatar ? [{ value: snapshot.avatar, observedAt: now }] : []
    },
    guilds: {},
    incidents: [],
    sources: [{ sourceId: "local", firstObservedAt: now, lastObservedAt: now }]
  };
}

function observeUser(profile, user) {
  const snapshot = snapshotUser(user);
  if (!profile || !snapshot) return profile;
  profile.lastSeenAt = Date.now();
  profile.type = snapshot.bot ? "bot" : "user";
  profile.accountCreatedAt = profile.accountCreatedAt || snapshot.accountCreatedAt;

  if (snapshot.username !== profile.current.username) {
    pushUniqueHistory(profile.history.usernames, snapshot.username);
    profile.current.username = snapshot.username;
  }
  if (snapshot.globalName !== profile.current.globalName) {
    pushUniqueHistory(profile.history.globalNames, snapshot.globalName);
    profile.current.globalName = snapshot.globalName;
  }
  if (snapshot.avatar !== profile.current.avatar) {
    pushUniqueHistory(profile.history.avatars, snapshot.avatar);
    profile.current.avatar = snapshot.avatar;
  }
  return profile;
}

function observeGuild(profile, guildMember) {
  if (!profile || !guildMember?.guild) return profile;
  const guildId = String(guildMember.guild.id);
  const now = Date.now();
  const existing = profile.guilds[guildId] || {};
  profile.guilds[guildId] = {
    firstObservedAt: existing.firstObservedAt || now,
    lastObservedAt: now,
    joinedAt: guildMember.joinedTimestamp ?? existing.joinedAt ?? null,
    leftAt: null,
    guildName: guildMember.guild.name ?? existing.guildName ?? null
  };
  const keys = Object.keys(profile.guilds);
  while (keys.length > MAX_GUILDS) delete profile.guilds[keys.shift()];
  return profile;
}

function observeLeave(profile, guild) {
  if (!profile || !guild?.id) return profile;
  const record = profile.guilds[String(guild.id)];
  if (record) record.leftAt = Date.now();
  profile.lastSeenAt = Date.now();
  return profile;
}

function addIncident(profile, incident) {
  if (!profile || !incident) return profile;
  profile.incidents.push({
    ...incident,
    time: Number(incident.time) || Date.now(),
    sourceId: incident.sourceId || "local"
  });
  while (profile.incidents.length > MAX_INCIDENTS) profile.incidents.shift();
  profile.lastSeenAt = Date.now();
  return profile;
}

module.exports = {
  DISCORD_EPOCH,
  accountCreatedAtFromId,
  snapshotUser,
  createProfile,
  observeUser,
  observeGuild,
  observeLeave,
  addIncident
};
