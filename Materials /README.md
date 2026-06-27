# Harris — Material Lead Time Tracker

Internal engineering tool for Industrialized Construction.
Pulls live commodity price indices from the FRED API (Federal Reserve)
and overlays them against the active job schedule to flag material
ordering risk before it becomes a schedule problem.

---

## Getting a FRED API key (free, 30 seconds)

1. Go to https://fred.stlouisfed.org/docs/api/api_key.html
2. Create a free account
3. Request an API key — approved instantly
4. Paste "f1bc1e8edf468493497168c682abd842" into the app when prompted

The key is stored only in your browser's localStorage. Nothing is sent
anywhere except directly to api.stlouisfed.org.

---

## Running locally

```bash
# Option 1 — VS Code Live Server (recommended)
# Install the "Live Server" extension, then right-click index.html → Open with Live Server

# Option 2 — Python simple server
python -m http.server 8000
# then open http://localhost:8000

# Option 3 — just open index.html in your browser
# (works fine for this app — no build step needed)
```

---

## Deploying to GitHub Pages

```bash
git init
git add .
git commit -m "Harris material tracker — initial build"
gh repo create harris-material-tracker --public --push --source=.
```

Then: GitHub repo → Settings → Pages → Source: Deploy from branch → main / (root)

Live at: https://yourusername.github.io/harris-material-tracker/

---

## How the code is structured

```
harris-material-tracker/
├── index.html   # Page structure and layout
├── styles.css   # All styling, light + dark mode tokens
├── data.js      # Harris job schedule (static — swap for Azure API fetch)
├── fred.js      # All FRED API calls, caching, error handling
└── app.js       # Risk logic, rendering, app controller
```

### The separation that matters

`fred.js` is your data access layer — it knows how to talk to FRED.
`data.js` is your business data — it knows about Harris jobs.
`app.js` is your logic layer — it combines both and renders.

At Harris, `fred.js` becomes calls to your Azure API (which itself
calls FRED or an ERP). `data.js` becomes a fetch to your Azure SQL
job schedule endpoint. `app.js` stays almost identical.

---

## FRED series used

| Series ID   | What it measures                        |
|-------------|-----------------------------------------|
| WPU101      | Steel mill products price index         |
| WPU102502   | Copper and brass mill shapes            |
| WPU1191     | HVAC equipment                          |
| WPU0561     | Millwork and prefabricated structures   |
| WPU1012     | Aluminum mill shapes (electrical conduit)|

All are Producer Price Index (PPI) series from the Bureau of Labor Statistics,
served through the FRED API. Monthly frequency.

---

## Risk calculation logic (app.js)

Schedule risk:
  order_deadline = job_start_date - lead_weeks * 7
  days_until_deadline = order_deadline - today
  HIGH  if days <= 0 (overdue) or days <= 14
  MED   if days <= 30
  LOW   otherwise

Price risk:
  HIGH  if YoY price change > 8%
  MED   if YoY price change > 3%
  LOW   otherwise

Combined risk = max(schedule_risk, price_risk)

---

## Swapping in Azure SQL job data

In data.js, replace HARRIS_JOBS with a fetch:

```js
async function fetchJobs() {
  const res = await fetch("https://your-app.azurewebsites.net/api/jobs");
  if (!res.ok) throw new Error("Failed to load jobs");
  return res.json();
}
```

In app.js init(), replace:
  const rows = buildMaterialRows(marketData);
with:
  const jobs = await fetchJobs();
  const rows = buildMaterialRows(marketData, jobs);

And update buildMaterialRows() to accept jobs as a parameter
instead of reading from the global HARRIS_JOBS constant.
