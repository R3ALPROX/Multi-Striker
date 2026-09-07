const DEFAULT_TIMEOUT_MS = 4500;
const providers = new Map();

function envName(slot, suffix) {
  return `AI_${slot}_${suffix}`;
}

function getProvider(slot) {
  const key = String(slot || "").toUpperCase();
  const url = process.env[envName(key, "URL")];
  if (!url) return null;
  return {
    name: process.env[envName(key, "NAME")] || key,
    url,
    apiKey: process.env[envName(key, "KEY")] || null,
    timeoutMs: Number(process.env[envName(key, "TIMEOUT_MS")]) || DEFAULT_TIMEOUT_MS
  };
}

async function callProvider(slot, payload) {
  const provider = getProvider(slot);
  if (!provider || typeof fetch !== "function") return { ok: false, unavailable: true, error: "Provider not configured" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), provider.timeoutMs);
  const started = Date.now();

  try {
    const headers = { "content-type": "application/json" };
    if (provider.apiKey) headers.authorization = `Bearer ${provider.apiKey}`;
    const response = await fetch(provider.url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    let data;
    try { data = JSON.parse(text); } catch (_) { throw new Error("Provider returned non-JSON data"); }
    providers.set(slot, { ok: true, at: Date.now(), latencyMs: Date.now() - started });
    return { ok: true, provider: provider.name, data, latencyMs: Date.now() - started };
  } catch (error) {
    providers.set(slot, { ok: false, at: Date.now(), error: String(error?.message || error) });
    return { ok: false, provider: provider.name, error: String(error?.message || error) };
  } finally {
    clearTimeout(timer);
  }
}

function providerStatus() {
  return Object.fromEntries([...providers.entries()].map(([slot, state]) => [slot, { ...state }]));
}

module.exports = { getProvider, callProvider, providerStatus };
