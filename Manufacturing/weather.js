// weather.js
// Open-Meteo API integration — no API key required.
// Fetches 7-day hourly forecasts for job site coordinates.
// Docs: https://open-meteo.com/en/docs

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";
const WEATHER_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// WMO weather interpretation codes → human label + severity
const WMO_CODES = {
  0:  { label: "Clear",              severity: 0 },
  1:  { label: "Mainly clear",       severity: 0 },
  2:  { label: "Partly cloudy",      severity: 0 },
  3:  { label: "Overcast",           severity: 0 },
  45: { label: "Fog",                severity: 1 },
  48: { label: "Icy fog",            severity: 2 },
  51: { label: "Light drizzle",      severity: 1 },
  53: { label: "Drizzle",            severity: 1 },
  55: { label: "Heavy drizzle",      severity: 2 },
  61: { label: "Light rain",         severity: 1 },
  63: { label: "Rain",               severity: 2 },
  65: { label: "Heavy rain",         severity: 3 },
  71: { label: "Light snow",         severity: 2 },
  73: { label: "Snow",               severity: 3 },
  75: { label: "Heavy snow",         severity: 3 },
  80: { label: "Rain showers",       severity: 2 },
  81: { label: "Heavy showers",      severity: 3 },
  95: { label: "Thunderstorm",       severity: 3 },
  99: { label: "Severe storm",       severity: 3 },
};

function decodeWMO(code) {
  return WMO_CODES[code] || { label: `Code ${code}`, severity: 1 };
}

function getCached(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    return Date.now() - ts < WEATHER_CACHE_TTL ? data : null;
  } catch { return null; }
}

function setCache(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch { /* storage full */ }
}

// Fetch 7-day daily forecast for a lat/lon
async function fetchSiteForecast(site) {
  const cacheKey = `wx_${site.lat}_${site.lon}`;
  const cached   = getCached(cacheKey);
  if (cached) return cached;

  const url = new URL(OPEN_METEO_BASE);
  url.searchParams.set("latitude",              site.lat);
  url.searchParams.set("longitude",             site.lon);
  url.searchParams.set("daily",                 [
    "weathercode",
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_sum",
    "windspeed_10m_max",
  ].join(","));
  url.searchParams.set("temperature_unit",      "fahrenheit");
  url.searchParams.set("windspeed_unit",        "kmh");
  url.searchParams.set("precipitation_unit",    "mm");
  url.searchParams.set("timezone",              "America/New_York");
  url.searchParams.set("forecast_days",         "7");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Weather API error: ${res.status}`);
  const json = await res.json();

  // Shape the daily array into something easy to work with
  const daily = json.daily.time.map((date, i) => ({
    date,
    weatherCode:   json.daily.weathercode[i],
    weatherLabel:  decodeWMO(json.daily.weathercode[i]).label,
    severity:      decodeWMO(json.daily.weathercode[i]).severity,
    tempMax:       Math.round(json.daily.temperature_2m_max[i]),
    tempMin:       Math.round(json.daily.temperature_2m_min[i]),
    precipitation: json.daily.precipitation_sum[i],
    windSpeed:     Math.round(json.daily.windspeed_10m_max[i]),
  }));

  const result = { site, daily, fetchedAt: new Date().toISOString() };
  setCache(cacheKey, result);
  return result;
}

// Returns true if any day in the forecast is a delivery risk
function hasDeliveryRisk(forecast) {
  return forecast.daily.some(d =>
    d.windSpeed     >= WEATHER_THRESHOLDS.windSpeed     ||
    d.precipitation >= WEATHER_THRESHOLDS.precipitation ||
    d.severity      >= 3
  );
}

// Get the worst day in the next 7 days
function worstDay(forecast) {
  return forecast.daily.reduce((worst, d) => {
    const score = d.severity * 10 + (d.windSpeed / 10) + (d.precipitation / 2);
    const worstScore = worst.severity * 10 + (worst.windSpeed / 10) + (worst.precipitation / 2);
    return score > worstScore ? d : worst;
  }, forecast.daily[0]);
}

// Fetch all active job site forecasts in parallel
async function fetchAllForecasts(sites) {
  const results = await Promise.allSettled(sites.map(s => fetchSiteForecast(s)));
  return results
    .map((r, i) => r.status === "fulfilled" ? r.value : null)
    .filter(Boolean);
}
