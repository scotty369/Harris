// app.js
// Orchestrates data loading, risk calculation, and rendering.
// Reads from HARRIS_JOBS (data.js) and FRED market data (fred.js).

// ── Risk calculation ──────────────────────────────────────────────────────────
// This is the real business logic Harris cares about:
// Given a job's start date and a material's lead time, when does the order
// need to be placed? And given current price trends, is there cost risk too?

function calcOrderDeadline(jobStartDate, leadWeeks) {
  const start = new Date(jobStartDate);
  const deadline = new Date(start);
  deadline.setDate(deadline.getDate() - leadWeeks * 7);
  return deadline;
}

function calcScheduleRisk(jobStartDate, leadWeeks) {
  const today = new Date();
  const deadline = calcOrderDeadline(jobStartDate, leadWeeks);
  const daysUntilDeadline = Math.round((deadline - today) / (1000 * 60 * 60 * 24));

  if (daysUntilDeadline < 0)   return { level: "high", label: "Order overdue",     days: daysUntilDeadline };
  if (daysUntilDeadline <= 14) return { level: "high", label: "Order critical",     days: daysUntilDeadline };
  if (daysUntilDeadline <= 30) return { level: "med",  label: "Order soon",         days: daysUntilDeadline };
  return                               { level: "low",  label: "On track",           days: daysUntilDeadline };
}

function calcPriceRisk(marketData, seriesId) {
  const series = marketData[seriesId];
  if (!series) return { level: "unknown", label: "No data", yoy: null };

  const yoy = series.yoyChangePct;
  if (yoy > 8)  return { level: "high", label: `+${yoy}% YoY`, yoy };
  if (yoy > 3)  return { level: "med",  label: `+${yoy}% YoY`, yoy };
  if (yoy < -3) return { level: "low",  label: `${yoy}% YoY`,  yoy };
  return               { level: "low",  label: `${yoy}% YoY`,  yoy };
}

function combinedRisk(schedRisk, priceRisk) {
  const levels = { high: 2, med: 1, low: 0, unknown: 0 };
  const combined = Math.max(levels[schedRisk.level], levels[priceRisk.level]);
  return combined === 2 ? "high" : combined === 1 ? "med" : "low";
}

// Build a flat list of all material rows for the table
function buildMaterialRows(marketData) {
  const rows = [];
  HARRIS_JOBS.forEach(job => {
    job.materials.forEach(mat => {
      const schedRisk  = calcScheduleRisk(job.startDate, mat.leadWeeks);
      const priceRisk  = calcPriceRisk(marketData, mat.fredSeries);
      const orderBy    = calcOrderDeadline(job.startDate, mat.leadWeeks);
      const riskLevel  = combinedRisk(schedRisk, priceRisk);
      rows.push({ job, mat, schedRisk, priceRisk, orderBy, riskLevel });
    });
  });
  // Sort: high risk first
  const order = { high: 0, med: 1, low: 2 };
  return rows.sort((a, b) => order[a.riskLevel] - order[b.riskLevel]);
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtDate(d) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtDeadline(d) {
  const today = new Date();
  const days  = Math.round((d - today) / (1000 * 60 * 60 * 24));
  if (days < 0)  return `<span style="color:var(--text-danger);font-weight:500">${fmtDate(d)} (${Math.abs(days)}d ago)</span>`;
  if (days <= 14)return `<span style="color:var(--text-danger);font-weight:500">${fmtDate(d)} (${days}d)</span>`;
  if (days <= 30)return `<span style="color:var(--text-warning);font-weight:500">${fmtDate(d)} (${days}d)</span>`;
  return `<span style="color:var(--text-muted)">${fmtDate(d)} (${days}d)</span>`;
}

// ── Renderers ─────────────────────────────────────────────────────────────────

function renderStatus(text, cls = "") {
  document.getElementById("api-status").textContent  = text;
  document.getElementById("api-status").className    = "api-status " + cls;
}

function renderMetrics(rows, marketData) {
  const highRisk = rows.filter(r => r.riskLevel === "high").length;
  const medRisk  = rows.filter(r => r.riskLevel === "med").length;
  const overdue  = rows.filter(r => r.schedRisk.days < 0).length;

  // Average YoY price change across all tracked commodities
  const yoys = Object.values(marketData).map(s => s.yoyChangePct).filter(v => v != null);
  const avgYoy = yoys.length ? (yoys.reduce((a, b) => a + b, 0) / yoys.length).toFixed(1) : "—";

  document.getElementById("metrics").innerHTML = `
    <div class="metric-card">
      <div class="metric-label">Total material lines</div>
      <div class="metric-value neutral">${rows.length}</div>
      <div class="metric-sub">across ${HARRIS_JOBS.length} active jobs</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">High-risk lines</div>
      <div class="metric-value ${highRisk > 0 ? "danger" : "good"}">${highRisk}</div>
      <div class="metric-sub">order overdue or critical</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Needs attention</div>
      <div class="metric-value ${medRisk > 2 ? "warn" : "neutral"}">${medRisk}</div>
      <div class="metric-sub">order within 30 days</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Avg commodity inflation</div>
      <div class="metric-value ${parseFloat(avgYoy) > 5 ? "warn" : "good"}">${avgYoy}%</div>
      <div class="metric-sub">year-over-year (FRED)</div>
    </div>
  `;
}

function renderCommodities(marketData) {
  const entries = Object.entries(marketData);
  if (!entries.length) {
    document.getElementById("commodity-list").innerHTML =
      `<div class="state-msg skeleton">Loading FRED data...</div>`;
    return;
  }

  document.getElementById("commodity-list").innerHTML = entries.map(([id, s]) => {
    const yoy   = s.yoyChangePct;
    const dir   = yoy > 1 ? "up" : yoy < -1 ? "down" : "flat";
    const label = yoy > 0 ? `+${yoy}%` : `${yoy}%`;
    const cls   = dir === "up" ? "delta-up" : dir === "down" ? "delta-down" : "delta-flat";
    const seriesLabel = FRED_SERIES[id] ? FRED_SERIES[id].label : id;

    return `
      <div class="commodity-row">
        <div class="commodity-name">${seriesLabel}</div>
        <div class="commodity-val">${s.latestValue.toFixed(1)}</div>
        <div class="commodity-delta ${cls}">${label} YoY</div>
        <div class="commodity-note">as of ${fmtDate(s.latestDate)}</div>
      </div>
    `;
  }).join("");
}

function renderRisk(rows) {
  const risky = rows.filter(r => r.riskLevel === "high" || r.riskLevel === "med").slice(0, 6);
  if (!risky.length) {
    document.getElementById("risk-list").innerHTML =
      `<div class="state-msg">No at-risk material lines.</div>`;
    return;
  }
  document.getElementById("risk-list").innerHTML = risky.map(r => `
    <div class="risk-item">
      <div class="risk-dot ${r.riskLevel}"></div>
      <div>
        <div class="risk-title">${r.job.name} — ${r.mat.name}</div>
        <div class="risk-sub">
          ${r.schedRisk.label}
          ${r.schedRisk.days >= 0 ? `· order by ${fmtDate(r.orderBy)}` : "· already past deadline"}
          ${r.priceRisk.yoy != null ? ` · price ${r.priceRisk.label}` : ""}
        </div>
      </div>
    </div>
  `).join("");
}

function renderTable(rows) {
  if (!rows.length) {
    document.getElementById("job-body").innerHTML =
      `<tr><td colspan="8" class="state-msg">No data.</td></tr>`;
    return;
  }

  document.getElementById("job-body").innerHTML = rows.map(r => {
    const badgeCls = { high: "badge-high", med: "badge-med", low: "badge-low", unknown: "badge-unknown" };
    const riskLabel = {
      high: r.schedRisk.days < 0 ? "Overdue" : "Critical",
      med:  "Attention",
      low:  "On track",
      unknown: "No data"
    };
    const trendCls  = r.priceRisk.yoy > 1 ? "trend-up" : r.priceRisk.yoy < -1 ? "trend-down" : "trend-flat";
    const trendArrow= r.priceRisk.yoy > 1 ? "▲" : r.priceRisk.yoy < -1 ? "▼" : "–";

    return `<tr>
      <td title="${r.job.name}" style="font-weight:500">${r.job.name}</td>
      <td>${r.mat.name}</td>
      <td>${r.mat.qty.toLocaleString()} ${r.mat.unit}</td>
      <td>${r.mat.leadWeeks} wks</td>
      <td>${fmtDeadline(r.orderBy)}</td>
      <td style="color:var(--text-secondary)">${fmtDate(r.job.startDate)}</td>
      <td>
        ${r.priceRisk.yoy != null
          ? `<span class="trend-pill ${trendCls}">${trendArrow} ${r.priceRisk.label}</span>`
          : `<span class="trend-pill trend-flat">No data</span>`
        }
      </td>
      <td><span class="badge ${badgeCls[r.riskLevel]}">${riskLabel[r.riskLevel]}</span></td>
    </tr>`;
  }).join("");
}

function renderChart(marketData) {
  const steel = marketData["WPU101"];
  if (!steel) return;

  const ctx = document.getElementById("price-chart").getContext("2d");
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const textColor = dark ? "#b4b2a9" : "#888780";
  const lineColor = "#378add";
  const gridColor = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

  // Destroy existing chart if re-rendering
  if (window._priceChart) window._priceChart.destroy();

  window._priceChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: steel.history.map(o => {
        const d = new Date(o.date);
        return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      }),
      datasets: [{
        data: steel.history.map(o => o.value),
        borderColor: lineColor,
        borderWidth: 1.5,
        pointRadius: 2,
        pointHoverRadius: 4,
        fill: false,
        tension: 0.3,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `Index: ${ctx.parsed.y.toFixed(1)}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { size: 11 }, maxTicksLimit: 8 },
          grid:  { color: gridColor }
        },
        y: {
          ticks: { color: textColor, font: { size: 11 } },
          grid:  { color: gridColor }
        }
      }
    }
  });
}

// ── App controller ────────────────────────────────────────────────────────────

const app = {
  async init() {
    const key = getApiKey();
    if (!key) {
      document.getElementById("api-key-banner").classList.add("visible");
      document.getElementById("metrics").innerHTML =
        `<div class="metric-card" style="grid-column:1/-1">
          <div class="metric-label">Enter your FRED API key above to load live market data.</div>
         </div>`;
      renderStatus("No API key", "error");
      return;
    }
    await this.load();
  },

  saveKey() {
    const input = document.getElementById("api-key-input").value.trim();
    if (!input) return;
    saveApiKey(input);
    document.getElementById("api-key-banner").classList.remove("visible");
    this.load();
  },

  async load() {
    renderStatus("Loading...", "");
    document.getElementById("job-body").innerHTML =
      `<tr><td colspan="8" class="state-msg skeleton">Fetching FRED market data...</td></tr>`;

    try {
      const seriesIds  = getAllSeriesIds();        // from data.js
      const marketData = await fetchAllSeriesSummaries(seriesIds);  // from fred.js
      const rows       = buildMaterialRows(marketData);

      renderStatus("Connected — FRED live data", "connected");
      renderMetrics(rows, marketData);
      renderCommodities(marketData);
      renderRisk(rows);
      renderTable(rows);
      renderChart(marketData);

    } catch (err) {
      renderStatus("Error", "error");
      console.error(err);
      document.getElementById("metrics").innerHTML =
        `<div class="metric-card" style="grid-column:1/-1;color:var(--text-danger)">
          ${err.message}
        </div>`;
      document.getElementById("job-body").innerHTML =
        `<tr><td colspan="8" class="state-msg" style="color:var(--text-danger)">${err.message}</td></tr>`;
    }
  },

  refresh() {
    // Clear session cache so we get fresh FRED data
    sessionStorage.clear();
    this.load();
  }
};

document.addEventListener("DOMContentLoaded", () => app.init());
