// fred.js
// All FRED API interaction lives here.
// This is your "data access layer" — app.js never calls fetch() directly.
// At Harris, this file becomes your Azure API calls instead.

const FRED_BASE = "https://api.stlouisfed.org/fred";
const CACHE_KEY = "harris_fred_cache";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in ms
const CORS_PROXY_BUILDERS = [
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

// ── Key management ────────────────────────────────────────────────────────────

function getApiKey() {
  return localStorage.getItem("fred_api_key") || "";
}

function saveApiKey(key) {
  localStorage.setItem("fred_api_key", key.trim());
}

// ── Cache ────────────────────────────────────────────────────────────────────
// Caching matters: FRED rate-limits to 120 requests/minute.
// At Harris, your Azure API would handle caching server-side in Redis or SQL.

function getCached(cacheKey) {
  try {
    const raw = sessionStorage.getItem(cacheKey);
    if (!raw) return null;
    const { timestamp, data } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function setCache(cacheKey, data) {
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data }));
  } catch { /* storage full — skip */ }
}

async function fetchJsonWithFallback(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (directErr) {
    for (const buildProxyUrl of CORS_PROXY_BUILDERS) {
      try {
        const proxyUrl = buildProxyUrl(url);
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch {
        // Try the next fallback.
      }
    }
    throw directErr;
  }
}

// ── Core fetch ───────────────────────────────────────────────────────────────

async function fredFetch(endpoint, params = {}) {
  const key = getApiKey();
  if (!key) throw new Error("No API key set");

  const url = new URL(`${FRED_BASE}/${endpoint}`);
  url.searchParams.set("api_key", key);
  url.searchParams.set("file_type", "json");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const cacheKey = url.toString();
  const cached = getCached(cacheKey);
  if (cached) return cached;

  let data;
  try {
    data = await fetchJsonWithFallback(url.toString());
  } catch (err) {
    if (err.message.includes("403")) throw new Error("Invalid API key — check your FRED key");
    if (err.name === "TypeError") throw new Error("Unable to reach FRED from this deployment. Try the proxy fallback or use an Azure relay.");
    throw new Error(`FRED API error: ${err.message}`);
  }
  setCache(cacheKey, data);
  return data;
}

// ── Public API ───────────────────────────────────────────────────────────────

// Fetch the last N observations for a series.
// Returns array of { date: "YYYY-MM-DD", value: number }
async function fetchSeriesObservations(seriesId, limit = 24) {
  const data = await fredFetch("series/observations", {
    series_id: seriesId,
    sort_order: "desc",
    limit: limit,
    observation_start: "2024-01-01",
  });

  return data.observations
    .filter(o => o.value !== ".")      // FRED uses "." for missing data
    .map(o => ({ date: o.date, value: parseFloat(o.value) }))
    .reverse();                         // back to chronological order
}

// Fetch metadata (title, units, frequency) for a series
async function fetchSeriesInfo(seriesId) {
  const data = await fredFetch("series", { series_id: seriesId });
  return data.seriess[0];  // FRED returns an array even for single series
}

// Fetch latest value + 12-month change for a series
async function fetchSeriesSummary(seriesId) {
  const obs = await fetchSeriesObservations(seriesId, 24);
  if (!obs.length) return null;

  const latest = obs[obs.length - 1];
  const yearAgo = obs.length >= 12 ? obs[obs.length - 13] : obs[0];
  const monthAgo = obs.length >= 2  ? obs[obs.length - 2]  : obs[0];

  const yoyChange   = yearAgo.value  ? ((latest.value - yearAgo.value)  / yearAgo.value  * 100) : 0;
  const momChange   = monthAgo.value ? ((latest.value - monthAgo.value) / monthAgo.value * 100) : 0;

  return {
    seriesId,
    latestValue:  latest.value,
    latestDate:   latest.date,
    yoyChangePct: Math.round(yoyChange  * 10) / 10,
    momChangePct: Math.round(momChange  * 10) / 10,
    history:      obs,
  };
}

// Fetch summaries for multiple series — runs in parallel
async function fetchAllSeriesSummaries(seriesIds) {
  const results = await Promise.allSettled(
    seriesIds.map(id => fetchSeriesSummary(id))
  );

  const out = {};
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value) {
      out[seriesIds[i]] = r.value;
    }
  });
  return out;
}
