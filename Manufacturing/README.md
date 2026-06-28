# Harris — Manufacturing Work Order Tracker

Production floor dashboard for the IC Manufacturing team.
Tracks work orders through fabrication stages and overlays
live delivery weather forecasts for each job site.

## Running locally

  python -m http.server 8000  →  http://localhost:8000
  Or: right-click index.html → Open with Live Server in VS Code

  No API key needed — Open-Meteo is completely free and open.

## Deploying to GitHub Pages

  git add Manufacturing/
  git commit -m "Add manufacturing work order tracker"
  git push

  Live at: https://yourusername.github.io/harris/Manufacturing/

## How the weather integration works

  Uses the Open-Meteo API (open-meteo.com) — no key, no account.
  Fetches a 7-day daily forecast for each active job site's lat/lon.
  Flags delivery risk if any day exceeds:

    Wind speed   ≥ 48 km/h  (flatbed transport risk)
    Precipitation ≥ 5 mm    (outdoor installation affected)
    WMO severity ≥ 3        (heavy rain, snow, thunderstorm)

  Weather cards appear per job site. Risk flags appear on kanban
  cards and in the work order table.

## File structure

  index.html   —  Page layout and markup
  styles.css   —  Styling, light + dark mode
  data.js      —  Work orders and job site data (swap for Azure SQL fetch)
  weather.js   —  Open-Meteo API calls, WMO code decoding, caching
  app.js       —  Kanban rendering, metrics, table, app controller

## Swapping in real data at Harris

  In data.js, replace WORK_ORDERS with a fetch:

    async function fetchWorkOrders() {
      const res = await fetch("https://your-app.azurewebsites.net/api/workorders");
      return res.json();
    }

  Work orders in Azure SQL would join to:
    - jobs table  (site location, client, schedule)
    - assemblies  (BOM, materials)
    - employees   (assigned fabricator/assembler)
    - materials   (tied to PO tracker for blocked reason auto-detection)

## What makes this realistic to Harris

  The kanban view maps to how shop supervisors actually think —
  they want to see what's moving through the floor, not a table.

  The blocked reason field would, in production, be auto-populated
  by the PO tracker: if a work order's required material has a
  Late PO, the blocked reason auto-fills. Cross-app data flow
  like this is the kind of integration BAIT cares about.

  Weather risk matters for module delivery: oversized flatbed
  loads can't run in high winds, and outdoor installation stalls
  in heavy rain. Flagging this before dispatch saves a wasted trip.
