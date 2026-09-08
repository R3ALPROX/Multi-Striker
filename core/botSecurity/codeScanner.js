const fs = require("node:fs");
const path = require("node:path");

// Static-only source inspection. Never execute the inspected bot code.
// This is intentionally modular so stronger scanners can be added later.
const RULES = [
  { id: "child_process", pattern: /\b(?:child_process|execSync|spawnSync|execFileSync|spawn)\b/i, severity: "HIGH", reason: "process execution API referenced" },
  { id: "dynamic_code", pattern: /\b(?:eval|new\s+Function)\s*\(/i, severity: "HIGH", reason: "dynamic code execution referenced" },
  { id: "network_download", pattern: /\b(?:https?|fetch|axios|got|request)\b[^\n]{0,160}(?:download|raw|paste|webhook)/i, severity: "MEDIUM", reason: "network/download pattern referenced" },
  { id: "webhook", pattern: /(?:discord(?:app)?\.com\/api\/webhooks|WebhookClient|createWebhook)/i, severity: "MEDIUM", reason: "webhook access referenced" },
  { id: "token_collection", pattern: /(?:DISCORD_TOKEN|BOT_TOKEN|process\.env\.TOKEN|clientLogin|login\s*\()/i, severity: "LOW", reason: "bot credential/login handling referenced" },
  { id: "obfuscation", pattern: /(?:Buffer\.from\([^\n]{0,300},\s*["']base64["']\)|atob\s*\(|fromCharCode\s*\()/i, severity: "MEDIUM", reason: "encoded/obfuscated data pattern referenced" }
];

const MAX_FILES = 200;
const MAX_FILE_BYTES = 512 * 1024;
const EXTENSIONS = new Set([".js", ".cjs", ".mjs", ".json", ".ts", ".tsx", ".jsx"]);
const SKIP = new Set(["node_modules", ".git", ".next", "dist", "build", "coverage"]);

function walk(root, out = []) {
  if (out.length >= MAX_FILES) return out;
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    if (out.length >= MAX_FILES || SKIP.has(entry.name)) continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (EXTENSIONS.has(path.extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

function scanText(text, file) {
  const findings = [];
  for (const rule of RULES) {
    if (rule.pattern.test(text)) findings.push({ ...rule, file });
  }
  return findings;
}

function scanBotSource(sourcePath) {
  const root = path.resolve(String(sourcePath || ""));
  if (!root || !fs.existsSync(root)) {
    return { status: "UNAVAILABLE", safeToExecute: false, filesScanned: 0, findings: [], reason: "Local source path is unavailable" };
  }
  const stat = fs.statSync(root);
  const files = stat.isDirectory() ? walk(root) : [root];
  const findings = [];
  let filesScanned = 0;
  for (const file of files.slice(0, MAX_FILES)) {
    try {
      if (fs.statSync(file).size > MAX_FILE_BYTES) continue;
      const text = fs.readFileSync(file, "utf8");
      findings.push(...scanText(text, path.relative(root, file) || path.basename(file)));
      filesScanned++;
    } catch {}
  }
  const high = findings.filter(f => f.severity === "HIGH").length;
  const medium = findings.filter(f => f.severity === "MEDIUM").length;
  const risk = Math.min(100, high * 35 + medium * 15 + findings.filter(f => f.severity === "LOW").length * 5);
  return {
    status: "SCANNED",
    safeToExecute: false,
    filesScanned,
    findings,
    risk,
    verdict: high ? "REJECT_FOR_MANUAL_REVIEW" : medium ? "REVIEW" : "NO_HIGH_RISK_PATTERN_FOUND",
    reason: "Static inspection only; absence of findings does not prove the source is safe"
  };
}

module.exports = { scanBotSource, scanText, RULES };
