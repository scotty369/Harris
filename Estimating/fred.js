// fred.js  — identical pattern to the material tracker.
// Same FRED API, same caching, same error handling.
// In a real Harris monorepo this would be a shared module both apps import.

const FRED_BASE   = "https://api.stlouisfed.org/fred";
const CACHE_TTL   = 60 * 60 * 1000; // 1 hour
const CORS_PROXY_BUILDERS = [
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

function getApiKey()      { return localStorage.getItem("fred_api_key") || ""; }
function saveApiKey(key)  { localStorage.setItem("fred_api_key", key.trim()); }

function getCached(k) {
  try {
    const raw = sessionStorage.getItem(k);
    if (!raw) return null;
    const { timestamp, data } = JSON.parse(raw);
    return Date.now() - timestamp < CACHE_TTL ? data : null;
  } catch { return null; }
}

function setCache(k, data) {
  try { sessionStorage.setItem(k, JSON.stringify({ timestamp: Date.now(), data })); }
  catch { /* storage full */ }
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

async function fredFetch(endpoint, params = {}) {
  const key = getApiKey();
  if (!key) throw new Error("No API key set");

  const url = new URL(`${FRED_BASE}/${endpoint}`);
  url.searchParams.set("api_key", key);
  url.searchParams.set("file_type", "json");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const cacheKey = url.toString();
  const cached   = getCached(cacheKey);
  if (cached) return cached;

  let data;
  try {
    data = await fetchJsonWithFallback(url.toString());
  } catch (err) {
    if (err.message.includes("403")) throw new Error("Invalid API key");
    if (err.name === "TypeError") throw new Error("Unable to reach FRED from this deployment. Try the proxy fallback or use an Azure relay.");
    throw new Error(`FRED API error ${err.message}`);
  }
  setCache(cacheKey, data);
  return data;
}

// Returns last `limit` monthly observations for a series, chronological order
async function fetchObservations(seriesId, limit = 24) {
  const data = await fredFetch("series/observations", {
    series_id:         seriesId,
    sort_order:        "desc",
    limit:             limit,
    observation_start: "2023-01-01",
  });
  return data.observations
    .filter(o => o.value !== ".")
    .map(o => ({ date: o.date, value: parseFloat(o.value) }))
    .reverse();
}

// Returns a summary object for one series
async function fetchSummary(seriesId) {
  const obs = await fetchObservations(seriesId, 24);
  if (!obs.length) return null;

  const latest  = obs[obs.length - 1];
  const mo1     = obs.length >=  2 ? obs[obs.length -  2] : null;
  const mo6     = obs.length >=  7 ? obs[obs.length -  7] : null;
  const mo12    = obs.length >= 13 ? obs[obs.length - 13] : null;

  const pct = (from, to) =>
    from ? Math.round((to.value - from.value) / from.value * 1000) / 10 : null;

  return {
    seriesId,
    latest:      latest.value,
    latestValue: latest.value,
    latestDate:  latest.date,
    mo1:         mo1  ? mo1.value  : null,
    mo6:         mo6  ? mo6.value  : null,
    mo12:        mo12 ? mo12.value : null,
    momPct:      pct(mo1,  latest),
    yoy6Pct:     pct(mo6,  latest),
    yoyPct:      pct(mo12, latest),
    yoyChangePct:pct(mo12, latest),
    momChangePct:pct(mo1,  latest),
    history:     obs,
  };
}

// Fetch summaries for multiple series in parallel
async function fetchAllSummaries(seriesIds) {
  const results = await Promise.allSettled(seriesIds.map(id => fetchSummary(id)));
  const out = {};
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value) out[seriesIds[i]] = r.value;
  });
  return out;
}
