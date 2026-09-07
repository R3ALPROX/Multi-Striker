// Shared evidence format for future Multi-Striker instances.
// Network evidence is advisory only: local policy and Sentinel remain authoritative.

const TYPES = new Set([
  "profile_observation",
  "member_join",
  "member_leave",
  "incident",
  "ban_observed",
  "bot_observation"
]);

const MAX_REASON = 500;

function clamp(n) {
  return Math.max(0, Math.min(100, Number(n) || 0));
}

function createEvidence(input = {}) {
  const type = String(input.type || "");
  const subjectId = String(input.subjectId || "");
  if (!TYPES.has(type)) throw new Error("Unsupported evidence type");
  if (!/^\d{17,20}$/.test(subjectId)) throw new Error("Evidence subjectId must be a Discord ID");

  return {
    schemaVersion: 1,
    evidenceId: String(input.evidenceId || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`),
    type,
    subjectId,
    sourceId: String(input.sourceId || "unknown"),
    observedAt: Number(input.observedAt) || Date.now(),
    guildId: input.guildId ? String(input.guildId) : null,
    confidence: clamp(input.confidence),
    expiresAt: Number(input.expiresAt) || Date.now() + 7 * 24 * 60 * 60 * 1000,
    reason: input.reason ? String(input.reason).slice(0, MAX_REASON) : null,
    data: input.data && typeof input.data === "object" ? input.data : {}
  };
}

function isFresh(evidence, now = Date.now()) {
  return Boolean(evidence && Number(evidence.expiresAt) > now);
}

function mergeEvidence(existing, incoming, now = Date.now()) {
  const all = [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])];
  const byId = new Map();
  for (const item of all) {
    if (!item?.evidenceId || !isFresh(item, now)) continue;
    const current = byId.get(item.evidenceId);
    if (!current || Number(item.observedAt) > Number(current.observedAt)) byId.set(item.evidenceId, item);
  }
  return [...byId.values()]
    .sort((a, b) => Number(b.observedAt) - Number(a.observedAt))
    .slice(0, 200);
}

function summarizeSubject(evidenceList, subjectId, now = Date.now()) {
  const relevant = mergeEvidence([], evidenceList, now).filter(e => e.subjectId === String(subjectId));
  const weighted = relevant.reduce((sum, e) => sum + clamp(e.confidence), 0);
  const sourceCount = new Set(relevant.map(e => e.sourceId)).size;
  return {
    subjectId: String(subjectId),
    evidenceCount: relevant.length,
    sourceCount,
    confidence: Math.min(100, relevant.length ? Math.round(weighted / relevant.length) : 0),
    latestObservedAt: relevant.length ? Math.max(...relevant.map(e => Number(e.observedAt) || 0)) : null,
    evidence: relevant
  };
}

module.exports = { TYPES, createEvidence, isFresh, mergeEvidence, summarizeSubject };
