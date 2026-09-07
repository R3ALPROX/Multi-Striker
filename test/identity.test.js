const test = require("node:test");
const assert = require("node:assert/strict");
const { accountCreatedAtFromId, createProfile, observeUser, observeGuild, addIncident } = require("../core/identity/profile");
const { createEvidence, mergeEvidence, summarizeSubject } = require("../core/network/evidence");

test("identity profile keeps observed username and avatar history", () => {
  const first = { id: "123456789012345678", username: "alpha", globalName: "Alpha", avatar: "a1", bot: false };
  const profile = createProfile(first);
  observeUser(profile, { ...first, username: "beta", globalName: "Beta", avatar: "a2" });
  assert.equal(profile.current.username, "beta");
  assert.equal(profile.current.avatar, "a2");
  assert.equal(profile.history.usernames.length, 2);
  assert.equal(profile.history.usernames[0].value, "alpha");
  assert.equal(profile.history.avatars[0].value, "a1");
});

test("identity profile records per-server join time without inventing history", () => {
  const user = { id: "123456789012345679", username: "member", globalName: "Member", avatar: null, bot: false };
  const profile = createProfile(user);
  const joinedAt = 1700000000000;
  observeGuild(profile, { user, joinedTimestamp: joinedAt, guild: { id: "123456789012345680", name: "Test" } });
  assert.equal(profile.guilds["123456789012345680"].joinedAt, joinedAt);
  assert.equal(Object.keys(profile.guilds).length, 1);
});

test("Discord snowflake account creation timestamp is derived safely with BigInt", () => {
  const created = accountCreatedAtFromId("123456789012345678");
  assert.equal(typeof created, "number");
  assert.ok(created > 1420070400000);
});

test("incidents preserve unknown reasons instead of inventing one", () => {
  const user = { id: "123456789012345681", username: "member", globalName: null, avatar: null, bot: false };
  const profile = createProfile(user);
  addIncident(profile, { type: "moderation_observation", guildId: "123456789012345682", reason: null });
  assert.equal(profile.incidents[0].reason, null);
});

test("shared evidence expires and does not remain trusted forever", () => {
  const evidence = createEvidence({ type: "incident", subjectId: "123456789012345683", sourceId: "server-a", confidence: 90, expiresAt: Date.now() + 1000 });
  const merged = mergeEvidence([], [evidence]);
  const summary = summarizeSubject(merged, evidence.subjectId);
  assert.equal(summary.sourceCount, 1);
  assert.equal(summary.confidence, 90);
  assert.equal(mergeEvidence([], [evidence], Date.now() + 2000).length, 0);
});
