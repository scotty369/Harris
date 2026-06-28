// app.js
// Orchestrates work order rendering, kanban board, and weather integration.

let forecasts = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(str) {
  return new Date(str + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric"
  });
}

function daysUntil(str) {
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(str + "T00:00:00");
  return Math.round((target - today) / 86400000);
}

function shipByDisplay(str) {
  const d = daysUntil(str);
  if (d < 0)  return `<span class="urgency-overdue">${fmtDate(str)} (${Math.abs(d)}d late)</span>`;
  if (d <= 5) return `<span class="urgency-critical">${fmtDate(str)} (${d}d)</span>`;
  if (d <= 14)return `<span class="urgency-soon">${fmtDate(str)} (${d}d)</span>`;
  return `<span class="urgency-ok">${fmtDate(str)}</span>`;
}

function priorityBadge(p) {
  const map = { Critical:"badge-critical", High:"badge-high", Standard:"badge-standard" };
  return `<span class="badge ${map[p] || "badge-standard"}">${p}</span>`;
}

function stageBadge(s) {
  const map = {
    "Queued":         "stage-queued",
    "Fabrication":    "stage-fab",
    "Assembly":       "stage-asm",
    "QC":             "stage-qc",
    "Ready to ship":  "stage-ready",
    "Shipped":        "stage-shipped",
  };
  return `<span class="badge ${map[s] || ""}">${s}</span>`;
}

function weatherIcon(severity, windSpeed, precip) {
  if (severity >= 3 || windSpeed >= WEATHER_THRESHOLDS.windSpeed) return "⛈";
  if (severity === 2 || precip  >= WEATHER_THRESHOLDS.precipitation) return "🌧";
  if (severity === 1) return "🌦";
  return "☀️";
}

function getForecastForSite(jobId) {
  return forecasts.find(f => f.site.id === jobId) || null;
}

// ── Metrics ───────────────────────────────────────────────────────────────────

function renderMetrics() {
  const active   = WORK_ORDERS.filter(w => w.stage !== "Shipped");
  const blocked  = WORK_ORDERS.filter(w => w.blockedReason);
  const critical = WORK_ORDERS.filter(w => w.priority === "Critical" && w.stage !== "Shipped");
  const readyToShip = WORK_ORDERS.filter(w => w.stage === "Ready to ship");

  document.getElementById("metrics").innerHTML = `
    <div class="metric-card">
      <div class="metric-label">Active work orders</div>
      <div class="metric-value">${active.length}</div>
      <div class="metric-sub">${WORK_ORDERS.filter(w=>w.stage==="Shipped").length} shipped this cycle</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Blocked</div>
      <div class="metric-value ${blocked.length > 0 ? "danger" : "good"}">${blocked.length}</div>
      <div class="metric-sub">need resolution</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Critical priority</div>
      <div class="metric-value ${critical.length > 2 ? "warn" : "neutral"}">${critical.length}</div>
      <div class="metric-sub">in production</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Ready to ship</div>
      <div class="metric-value ${readyToShip.length > 0 ? "good" : "neutral"}">${readyToShip.length}</div>
      <div class="metric-sub">awaiting dispatch</div>
    </div>
  `;
}

// ── Kanban ────────────────────────────────────────────────────────────────────

function renderKanban() {
  const activeStages = STAGES.filter(s => s !== "Shipped");

  document.getElementById("kanban").innerHTML = activeStages.map(stage => {
    const wos = WORK_ORDERS.filter(w => w.stage === stage);
    return `
      <div class="kanban-col">
        <div class="kanban-header">
          <span class="kanban-stage">${stage}</span>
          <span class="kanban-count">${wos.length}</span>
        </div>
        <div class="kanban-cards">
          ${wos.length
            ? wos.map(wo => kanbanCard(wo)).join("")
            : `<div class="kanban-empty">No orders</div>`
          }
        </div>
      </div>
    `;
  }).join("");
}

function kanbanCard(wo) {
  const site     = getSiteById(wo.jobId);
  const fc       = getForecastForSite(wo.jobId);
  const risk     = fc ? hasDeliveryRisk(fc) : false;
  const d        = daysUntil(wo.shipBy);
  const urgent   = d <= 7 && wo.stage !== "Shipped";
  const wxBadge  = fc && risk ? `<span class="wx-flag">⚠ Weather risk</span>` : "";

  return `
    <div class="kanban-card ${wo.blockedReason ? "blocked" : ""} ${urgent ? "urgent" : ""}">
      <div class="card-id">${wo.id}</div>
      <div class="card-assembly">${wo.assembly}</div>
      <div class="card-site">${site ? site.city : wo.jobId}</div>
      <div class="card-footer">
        ${priorityBadge(wo.priority)}
        <span class="card-ship">Ship ${fmtDate(wo.shipBy)}</span>
      </div>
      ${wo.blockedReason
        ? `<div class="card-blocked">🚫 ${wo.blockedReason}</div>`
        : ""
      }
      ${wxBadge}
    </div>
  `;
}

// ── Weather grid ──────────────────────────────────────────────────────────────

function renderWeather() {
  if (!forecasts.length) {
    document.getElementById("weather-grid").innerHTML =
      `<div class="state-msg">No forecast data available.</div>`;
    return;
  }

  document.getElementById("weather-grid").innerHTML = forecasts.map(fc => {
    const risk     = hasDeliveryRisk(fc);
    const worst    = worstDay(fc);
    const activeWOs = WORK_ORDERS.filter(w =>
      w.jobId === fc.site.id && w.stage !== "Shipped"
    );

    return `
      <div class="weather-card ${risk ? "risk" : "clear"}">
        <div class="wx-header">
          <div>
            <div class="wx-site">${fc.site.name}</div>
            <div class="wx-city">${fc.site.city} · ${activeWOs.length} active WO${activeWOs.length !== 1 ? "s" : ""}</div>
          </div>
          <div class="wx-status ${risk ? "wx-warn" : "wx-ok"}">
            ${risk ? "⚠ Delivery risk" : "✓ Clear week"}
          </div>
        </div>
        <div class="wx-days">
          ${fc.daily.slice(0, 7).map(d => {
            const isRisky = d.windSpeed >= WEATHER_THRESHOLDS.windSpeed ||
                            d.precipitation >= WEATHER_THRESHOLDS.precipitation ||
                            d.severity >= 3;
            return `
              <div class="wx-day ${isRisky ? "wx-day-risk" : ""}">
                <div class="wx-day-label">${new Date(d.date + "T00:00:00").toLocaleDateString("en-US",{weekday:"short"})}</div>
                <div class="wx-icon">${weatherIcon(d.severity, d.windSpeed, d.precipitation)}</div>
                <div class="wx-temp">${d.tempMax}°</div>
                <div class="wx-detail">${d.windSpeed}km/h</div>
                <div class="wx-detail">${d.precipitation}mm</div>
              </div>
            `;
          }).join("")}
        </div>
        ${risk ? `
          <div class="wx-alert">
            Worst day: ${fmtDate(worst.date)} —
            ${worst.weatherLabel}, ${worst.windSpeed} km/h winds,
            ${worst.precipitation} mm precip.
            Review delivery schedule for affected work orders.
          </div>
        ` : ""}
      </div>
    `;
  }).join("");
}

// ── Table ─────────────────────────────────────────────────────────────────────

function renderTable() {
  const stage    = document.getElementById("f-stage").value;
  const job      = document.getElementById("f-job").value;
  const priority = document.getElementById("f-priority").value;

  const filtered = WORK_ORDERS.filter(w =>
    (stage    === "all" || w.stage    === stage)    &&
    (job      === "all" || w.jobId    === job)      &&
    (priority === "all" || w.priority === priority)
  );

  if (!filtered.length) {
    document.getElementById("wo-body").innerHTML =
      `<tr><td colspan="7" class="state-msg">No work orders match.</td></tr>`;
    return;
  }

  document.getElementById("wo-body").innerHTML = filtered.map(wo => {
    const site = getSiteById(wo.jobId);
    const fc   = getForecastForSite(wo.jobId);
    const risk = fc ? hasDeliveryRisk(fc) : false;
    const blockedCol = wo.blockedReason
      ? `<span class="blocked-text">🚫 ${wo.blockedReason}</span>`
      : (risk ? `<span class="wx-flag-sm">⚠ Weather risk at site</span>` : `<span style="color:var(--text-muted)">—</span>`);

    return `<tr class="${wo.blockedReason ? "row-blocked" : ""}">
      <td class="mono">${wo.id}</td>
      <td title="${wo.assembly}" style="font-weight:500">${wo.assembly}</td>
      <td style="color:var(--text-secondary)">${site ? site.name.split(" ").slice(0,2).join(" ") : wo.jobId}</td>
      <td>${stageBadge(wo.stage)}</td>
      <td>${priorityBadge(wo.priority)}</td>
      <td>${shipByDisplay(wo.shipBy)}</td>
      <td>${blockedCol}</td>
    </tr>`;
  }).join("");
}

function populateJobFilter() {
  const sel = document.getElementById("f-job");
  JOB_SITES.forEach(s => {
    const o = document.createElement("option");
    o.value = s.id;
    o.textContent = s.name.split(" ").slice(0,2).join(" ");
    sel.appendChild(o);
  });
}

// ── App controller ────────────────────────────────────────────────────────────

function renderStatus(text, cls) {
  const el = document.getElementById("api-status");
  el.textContent = text;
  el.className = "api-status " + cls;
}

const app = {
  async init() {
    populateJobFilter();
    renderMetrics();
    renderKanban();
    renderTable();
    await this.loadWeather();
  },

  async loadWeather() {
    renderStatus("Fetching forecasts...", "");
    try {
      const sites = getActiveSites();
      forecasts   = await fetchAllForecasts(sites);
      renderStatus("Live — Open-Meteo", "connected");
      renderWeather();
      renderKanban(); // re-render kanban with weather risk flags
      renderTable();  // re-render table with weather column
    } catch (err) {
      renderStatus("Weather unavailable", "error");
      console.error(err);
      document.getElementById("weather-grid").innerHTML =
        `<div class="state-msg" style="color:var(--text-danger)">${err.message}</div>`;
    }
  },

  renderTable,

  refresh() {
    sessionStorage.clear();
    this.loadWeather();
  }
};

document.addEventListener("DOMContentLoaded", () => app.init());
