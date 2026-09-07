const test = require("node:test");
const assert = require("node:assert/strict");
const {
  accountCreatedAtFromId,
  createProfile,
  observeUser,
  observeGuild,
  addIncident
} = require("../core/identity/profile");
const { createEvidence, mergeEvidence, summarizeSubject } = require("../core/network/evidence");
const evidenceStore = require("../core/network/evidenceStore");

const USER_ID = "123456789012345678";
const GUILD_ID = "987654321098765432";

function user(overrides = {}) {
  return {
    id: USER_ID,
    username: "alpha",
    globalName: "Alpha",
    avatar: "avatar-a",
    bot: false,
    ...overrides
  };
}

test("identity keeps observed username and avatar history", () => {
  const profile = createProfile(user());
  observeUser(profile, user({ username: "beta", globalName: "Beta", avatar: "avatar-b" }));

  assert.equal(profile.current.username, "beta");
  assert.equal(profile.current.avatar, "avatar-b");
  assert.deepEqual(profile.history.usernames.map(x => x.value), ["alpha", "beta"]);
  assert.deepEqual(profile.history.avatars.map(x => x.value), ["avatar-a", "avatar-b"]);
});

test("identity records per-guild join time without inventing global history", () => {
  const profile = createProfile(user());
  const joinedTimestamp = 1700000000000;
  observeGuild(profile, {
    guild: { id: GUILD_ID, name: "Test Guild" },
    joinedTimestamp
  });

  assert.equal(profile.guilds[GUILD_ID].joinedAt, joinedTimestamp);
  assert.equal(Object.keys(profile.guilds).length, 1);
});

test("identity records moderation incidents with an explicit reason or null", () => {
  const profile = createProfile(user());
  addIncident(profile, { type: "ban_observed", guildId: GUILD_ID, reason: null, sourceId: "local" });

  assert.equal(profile.incidents[0].reason, null);
  assert.equal(profile.incidents[0].sourceId, "local");
});

test("Discord snowflake timestamp extraction is deterministic", () => {
  const created = accountCreatedAtFromId(USER_ID);
  assert.ok(Number.isInteger(created));
  assert.ok(created > 0);
});

test("network evidence is bounded to fresh, deduplicated observations", () => {
  const now = Date.now();
  const fresh = createEvidence({
    evidenceId: "e1",
    type: "ban_observed",
    subjectId: USER_ID,
    sourceId: "node-a",
    observedAt: now,
    expiresAt: now + 10000,
    confidence: 90
  });
  const replacement = { ...fresh, observedAt: now + 1, confidence: 95 };
  const expired = { ...fresh, evidenceId: "expired", expiresAt: now - 1 };
  const merged = mergeEvidence([], [fresh, replacement, expired], now);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].confidence, 95);
});

test("network summary counts independent sources without making punishment decisions", () => {
  const now = Date.now();
  const evidence = [
    createEvidence({ type: "bot_observation", subjectId: USER_ID, sourceId: "node-a", observedAt: now, expiresAt: now + 10000, confidence: 80 }),
    createEvidence({ type: "member_join", subjectId: USER_ID, sourceId: "node-b", observedAt: now + 1, expiresAt: now + 10000, confidence: 60 })
  ];
  const summary = summarizeSubject(evidence, USER_ID, now);

  assert.equal(summary.sourceCount, 2);
  assert.equal(summary.evidenceCount, 2);
  assert.equal(summary.confidence, 70);
  assert.equal(summary.action, undefined);
});

test("network cache can be cleared between tests and does not persist stale evidence", () => {
  evidenceStore.clearAll();
  const now = Date.now();
  evidenceStore.ingest(createEvidence({
    evidenceId: "cache-1",
    type: "profile_observation",
    subjectId: USER_ID,
    sourceId: "node-a",
    observedAt: now,
    expiresAt: now + 10000,
    confidence: 75
  }));
  assert.equal(evidenceStore.get(USER_ID, now).evidenceCount, 1);
  evidenceStore.clear(USER_ID);
  assert.equal(evidenceStore.get(USER_ID, now).evidenceCount, 0);
});
