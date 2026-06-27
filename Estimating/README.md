# Harris — Estimating Cost Index Tool

Live construction cost index dashboard for the Estimating team.
Pulls Producer Price Index data from the FRED API and calculates
market-informed contingency rates for bid line items.

---

## Getting started

Same FRED API key as the material tracker — free at:
https://fred.stlouisfed.org/docs/api/api_key.html

Run locally:
  python -m http.server 8000  →  http://localhost:8000
  Or: right-click index.html → Open with Live Server in VS Code

Deploy to GitHub Pages:
  git init && git add . && git commit -m "Initial build"
  gh repo create harris-estimating-tool --public --push --source=.
  Then: Settings → Pages → Deploy from branch → main

---

## How the contingency calculator works

1. Estimator enters base cost for each material/labor line item
2. Tool pulls live YoY % change from FRED for the matching PPI series
3. Contingency rate is determined by rules in data.js:

   YoY > 10%  →  10% contingency  (Extreme)
   YoY > 6%   →   7% contingency  (High)
   YoY > 3%   →   5% contingency  (Moderate)
   YoY > 0%   →   3% contingency  (Standard)
   YoY > -3%  →   2% contingency  (Minimal)
   YoY ≤ -3%  →   1% contingency  (Minimal)

4. Adjusted total = base + (base × contingency rate)
5. Blended rate shown across all line items

---

## FRED series used

  WPU101          Structural steel (PPI)
  WPU102502       Copper and brass mill shapes (PPI)
  WPU1012         Aluminum mill shapes / electrical conduit (PPI)
  WPU0561         Millwork and prefabricated structures (PPI)
  WPU1191         HVAC equipment (PPI)
  PCU2382--2382-- Building construction services (PPI)
  WPU0811         Lumber and wood products (PPI)

---

## File structure

  index.html  —  Page layout
  styles.css  —  Styling, light + dark mode
  data.js     —  FRED series config + contingency rules
  fred.js     —  FRED API calls, caching (reusable across Harris tools)
  app.js      —  Bid calculator, rendering, chart, app controller

---

## Swapping in Azure at Harris

fred.js → becomes calls to your Azure API (which calls FRED internally)
data.js → bid templates pulled from Azure SQL (per job type or client)
app.js  → stays largely the same
