const test = require("node:test");
const assert = require("node:assert/strict");
const { analyze } = require("../core/ai/brain");
const { runSecurityPipeline } = require("../core/ai/pipeline");

const destructiveEvents = [
  { type: "ROLE_DELETE", actorId: "attacker" },
  { type: "CHANNEL_DELETE", actorId: "attacker" },
  { type: "WEBHOOK_DELETE", actorId: "attacker" },
  { type: "ROLE_UPDATE", actorId: "attacker" }
];

test("local brain stays quiet with no evidence", () => {
  const result = analyze({ recentEvents: [] });
  assert.equal(result.action, "MONITOR");
  assert.equal(result.risk, 0);
});

test("local brain detects a multi-vector destructive pattern", () => {
  const result = analyze({ recentEvents: destructiveEvents });
  assert.ok(result.risk >= 35);
  assert.ok(["VERIFY", "ALERT", "CONTAIN"].includes(result.action));
  assert.ok(result.reasons.length >= 2);
});

test("local pipeline remains fail-closed for protected targets", () => {
  const result = runSecurityPipeline({
    guildId: "test-guild",
    protectedTarget: true,
    recentEvents: destructiveEvents
  });
  assert.notEqual(result.plan.action, "CONTAIN_MEMBER");
  assert.equal(result.supervisor.healthy, true);
});
