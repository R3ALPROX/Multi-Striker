const test = require("node:test");
const assert = require("node:assert/strict");
const { parseVerdict, sanitize, disabled } = require("../core/ai/externalVerifier");

test("external verifier has no action authority", () => {
  const result = disabled();
  assert.equal(result.canAct, false);
  assert.equal(result.canExecuteTools, false);
  assert.equal(result.canApproveActions, false);
  assert.equal(result.authority, "verification_only");
});

test("external verifier parses strict JSON verdicts", () => {
  const result = parseVerdict('{"verdict":"MALICIOUS","confidence":92,"rationale":"Repeated destructive activity","indicators":["rapid repetition"]}');
  assert.equal(result.verdict, "MALICIOUS");
  assert.equal(result.confidence, 92);
  assert.deepEqual(result.indicators, ["rapid repetition"]);
});

test("external verifier safely handles malformed output", () => {
  const result = parseVerdict("SUSPICIOUS behavior detected");
  assert.equal(result.verdict, "SUSPICIOUS");
  assert.equal(result.confidence, 0);
});

test("external verifier redacts obvious secrets", () => {
  const result = sanitize({ token: "secret-token", nested: { apiKey: "abc123" } });
  assert.equal(result.token, "token=[redacted]");
  assert.equal(result.nested.apiKey, "apiKey=[redacted]");
});
