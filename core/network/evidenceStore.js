// Local cache for evidence received from participating Multi-Striker instances.
// Network evidence is advisory. It never bypasses local Sentinel/policy.
const { mergeEvidence, summarizeSubject } = require("./evidence");

const MAX_EVIDENCE = 1000;
const evidenceBySubject = new Map();

function ingest(evidence) {
  if (!evidence?.subjectId) throw new Error("Evidence subjectId is required");
  const subjectId = String(evidence.subjectId);
  const current = evidenceBySubject.get(subjectId) || [];
  const merged = mergeEvidence(current, [evidence]);
  evidenceBySubject.set(subjectId, merged.slice(0, MAX_EVIDENCE));
  return get(subjectId);
}

function ingestMany(items) {
  for (const item of Array.isArray(items) ? items : []) ingest(item);
  return items?.length || 0;
}

function get(subjectId, now = Date.now()) {
  const id = String(subjectId);
  const current = evidenceBySubject.get(id) || [];
  const fresh = mergeEvidence([], current, now);
  evidenceBySubject.set(id, fresh);
  return summarizeSubject(fresh, id, now);
}

function clear(subjectId) {
  evidenceBySubject.delete(String(subjectId));
}

function clearAll() {
  evidenceBySubject.clear();
}

module.exports = { ingest, ingestMany, get, clear, clearAll };
