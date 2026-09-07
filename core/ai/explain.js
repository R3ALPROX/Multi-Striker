// Small, human-readable explanation layer for logs and future dashboards.
function summarize(result = {}) {
  return {
    risk: Number(result.risk) || 0,
    confidence: Number(result.confidence) || 0,
    level: result.level || "UNKNOWN",
    action: result.action || "MONITOR",
    reasons: Array.isArray(result.reasons) ? result.reasons.slice(0, 8) : [],
    evidence: Number(result.evidence) || 0,
    coordinated: Boolean(result.correlation?.coordinated),
    source: result.source || "local"
  };
}

function text(result = {}) {
  const r = summarize(result);
  const why = r.reasons.length ? r.reasons.join(", ") : "insufficient evidence";
  return `Risk ${r.risk}/100 (${r.level}), confidence ${r.confidence}%. Action: ${r.action}. Signals: ${why}.`;
}

module.exports = { summarize, text };
