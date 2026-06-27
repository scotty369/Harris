// app.js — Estimating cost index tool

let marketData = {};
let activeChartId = null;

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtPct(v) {
  if (v === null || v === undefined) return "—";
  return (v > 0 ? "+" : "") + v.toFixed(1) + "%";
}

function fmtMoney(v) {
  if (!v || isNaN(v)) return "$0";
  return "$" + Math.round(v).toLocaleString();
}

function parseMoney(str) {
  return parseFloat(str.replace(/[^0-9.]/g, "")) || 0;
}

function trendCls(pct) {
  if (pct === null) return "trend-flat";
  if (pct > 3)  return "trend-up";
  if (pct < -1) return "trend-down";
  return "trend-flat";
}

function trendArrow(pct) {
  if (pct === null) return "–";
  if (pct > 1)  return "▲";
  if (pct < -1) return "▼";
  return "–";
}

// ── Bid calculator ────────────────────────────────────────────────────────────

function renderBidInputs() {
  document.getElementById("bid-inputs").innerHTML = `
    <div class="bid-grid">
      ${BID_LINE_ITEMS.map(item => `
        <div class="bid-row">
          <label class="bid-label" for="bid-${item.key}">${item.label}</label>
          <div class="bid-input-wrap">
            <span class="bid-dollar">$</span>
            <input
              type="number"
              id="bid-${item.key}"
              class="bid-input"
              placeholder="${item.placeholder.replace("e.g. ","")}"
              oninput="recalcBid()"
              min="0"
            />
          </div>
          <div class="bid-contingency" id="ctg-${item.key}">—</div>
          <div class="bid-total" id="total-${item.key}">—</div>
        </div>
      `).join("")}
    </div>
    <div class="bid-col-headers">
      <span>Line item</span>
      <span>Base estimate</span>
      <span>Contingency rate</span>
      <span>Adjusted total</span>
    </div>
  `;
}

function recalcBid() {
  let baseTotal   = 0;
  let adjTotal    = 0;
  let hasAnyInput = false;

  BID_LINE_ITEMS.forEach(item => {
    const raw      = parseMoney(document.getElementById(`bid-${item.key}`).value);
    const series   = marketData[item.fredId];
    const yoy      = series ? series.yoyPct : null;
    const rate     = getContingencyRate(yoy);
    const ctgAmt   = raw * rate;
    const adjusted = raw + ctgAmt;
    const lbl      = contingencyLabel(rate);

    baseTotal += raw;
    adjTotal  += adjusted;
    if (raw > 0) hasAnyInput = true;

    document.getElementById(`ctg-${item.key}`).innerHTML =
      raw > 0
        ? `<span class="badge ${lbl.cls}">${(rate * 100).toFixed(0)}% · ${lbl.text}</span>`
        : `<span class="ctg-empty">—</span>`;

    document.getElementById(`total-${item.key}`).textContent =
      raw > 0 ? fmtMoney(adjusted) : "—";
  });

  const contingencyAmt = adjTotal - baseTotal;
  const avgRate = baseTotal > 0 ? contingencyAmt / baseTotal : 0;

  document.getElementById("bid-summary").innerHTML = hasAnyInput ? `
    <div class="summary-grid">
      <div class="summary-item">
        <div class="summary-label">Base estimate</div>
        <div class="summary-val">${fmtMoney(baseTotal)}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Market contingency</div>
        <div class="summary-val warn">+ ${fmtMoney(contingencyAmt)}</div>
        <div class="summary-sub">${(avgRate * 100).toFixed(1)}% blended rate</div>
      </div>
      <div class="summary-item highlight">
        <div class="summary-label">Adjusted bid total</div>
        <div class="summary-val">${fmtMoney(adjTotal)}</div>
      </div>
    </div>
    <div class="summary-note">
      Contingency rates are derived from live FRED Producer Price Index year-over-year changes.
      Final bid figures require estimator review and approval.
    </div>
  ` : `<div class="summary-empty">Enter line item amounts above to calculate a market-adjusted bid total.</div>`;
}

// ── Metrics ───────────────────────────────────────────────────────────────────

function renderMetrics() {
  const series = Object.values(marketData);
  if (!series.length) return;

  const yoys    = series.map(s => s.yoyPct).filter(v => v !== null);
  const avgYoy  = yoys.length ? yoys.reduce((a,b) => a+b, 0) / yoys.length : 0;
  const rising  = yoys.filter(v => v > 3).length;
  const falling = yoys.filter(v => v < -1).length;
  const maxYoy  = Math.max(...yoys);
  const maxSeries = series.find(s => s.yoyPct === maxYoy);
  const maxLabel  = maxSeries
    ? (ESTIMATE_INDICES.find(i => i.id === maxSeries.seriesId) || {}).label || maxSeries.seriesId
    : "—";

  document.getElementById("metrics").innerHTML = `
    <div class="metric-card">
      <div class="metric-label">Avg YoY inflation</div>
      <div class="metric-value ${avgYoy > 5 ? "warn" : avgYoy < 0 ? "good" : "neutral"}">
        ${fmtPct(Math.round(avgYoy * 10)/10)}
      </div>
      <div class="metric-sub">across ${series.length} tracked indices</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Rising indices</div>
      <div class="metric-value ${rising > 3 ? "warn" : "neutral"}">${rising}</div>
      <div class="metric-sub">up more than 3% YoY</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Falling indices</div>
      <div class="metric-value ${falling > 0 ? "good" : "neutral"}">${falling}</div>
      <div class="metric-sub">down more than 1% YoY</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Highest pressure</div>
      <div class="metric-value neutral" style="font-size:14px;margin-top:2px">${maxLabel}</div>
      <div class="metric-sub">${fmtPct(maxYoy)} YoY</div>
    </div>
  `;
}

// ── Index cards ───────────────────────────────────────────────────────────────

function renderIndexGrid() {
  document.getElementById("index-grid").innerHTML = ESTIMATE_INDICES.map(idx => {
    const s   = marketData[idx.id];
    const yoy = s ? s.yoyPct : null;
    const mom = s ? s.momPct : null;
    const rate = getContingencyRate(yoy);
    const lbl  = contingencyLabel(rate);

    return `
      <div class="index-card ${activeChartId === idx.id ? "active" : ""}"
           onclick="selectChart('${idx.id}')">
        <div class="index-card-top">
          <div class="index-cat">${idx.category}</div>
          <span class="badge ${lbl.cls}">${(rate*100).toFixed(0)}% ctg</span>
        </div>
        <div class="index-name">${idx.label}</div>
        <div class="index-val">${s ? s.latest.toFixed(1) : "—"}</div>
        <div class="index-trends">
          <span class="trend-pill ${trendCls(mom)}">
            ${trendArrow(mom)} ${fmtPct(mom)} MoM
          </span>
          <span class="trend-pill ${trendCls(yoy)}">
            ${trendArrow(yoy)} ${fmtPct(yoy)} YoY
          </span>
        </div>
        <div class="index-desc">${idx.description}</div>
      </div>
    `;
  }).join("");

  // Chart tabs
  document.getElementById("chart-tabs").innerHTML = ESTIMATE_INDICES.map(idx => `
    <button class="chart-tab ${activeChartId === idx.id ? "active" : ""}"
            onclick="selectChart('${idx.id}')">${idx.label}</button>
  `).join("");
}

// ── Chart ─────────────────────────────────────────────────────────────────────

function selectChart(seriesId) {
  activeChartId = seriesId;
  renderIndexGrid();
  renderChart(seriesId);
}

function renderChart(seriesId) {
  const s = marketData[seriesId];
  if (!s) return;

  const idx   = ESTIMATE_INDICES.find(i => i.id === seriesId);
  const label = idx ? idx.label : seriesId;
  const dark  = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const textColor = dark ? "#b4b2a9" : "#888780";
  const gridColor = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

  // Color line by trend
  const yoy = s.yoyPct;
  const lineColor = yoy > 5 ? "#e24b4a" : yoy < -1 ? "#639922" : "#378add";

  if (window._chart) window._chart.destroy();

  window._chart = new Chart(
    document.getElementById("price-chart").getContext("2d"), {
    type: "line",
    data: {
      labels: s.history.map(o => {
        const d = new Date(o.date);
        return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      }),
      datasets: [{
        label,
        data:        s.history.map(o => o.value),
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
        tooltip: { callbacks: { label: c => `${label}: ${c.parsed.y.toFixed(1)}` } }
      },
      scales: {
        x: { ticks: { color: textColor, font: { size: 11 }, maxTicksLimit: 8 }, grid: { color: gridColor } },
        y: { ticks: { color: textColor, font: { size: 11 } },                   grid: { color: gridColor } }
      }
    }
  });

  document.getElementById("chart-footer").textContent =
    `${label} · Current: ${s.latest.toFixed(1)} (${new Date(s.latestDate).toLocaleDateString("en-US",{month:"long",year:"numeric"})}) · YoY: ${fmtPct(yoy)}`;
}

// ── Summary table ─────────────────────────────────────────────────────────────

function renderTable() {
  document.getElementById("index-body").innerHTML = ESTIMATE_INDICES.map(idx => {
    const s = marketData[idx.id];
    if (!s) return `<tr><td colspan="6">${idx.label}</td></tr>`;

    return `<tr onclick="selectChart('${idx.id}')" style="cursor:pointer">
      <td style="font-weight:500">${idx.label}</td>
      <td>${s.latest.toFixed(1)}</td>
      <td style="color:var(--text-secondary)">${s.mo1  ? s.mo1.toFixed(1)  : "—"}</td>
      <td style="color:var(--text-secondary)">${s.mo6  ? s.mo6.toFixed(1)  : "—"}</td>
      <td style="color:var(--text-secondary)">${s.mo12 ? s.mo12.toFixed(1) : "—"}</td>
      <td>
        <span class="trend-pill ${trendCls(s.yoyPct)}">
          ${trendArrow(s.yoyPct)} ${fmtPct(s.yoyPct)}
        </span>
      </td>
    </tr>`;
  }).join("");
}

// ── App controller ────────────────────────────────────────────────────────────

function renderStatus(text, cls) {
  const el = document.getElementById("api-status");
  el.textContent = text;
  el.className   = "api-status " + cls;
}

const app = {
  async init() {
    renderBidInputs();
    recalcBid();

    const key = getApiKey();
    if (!key) {
      document.getElementById("api-key-banner").classList.add("visible");
      renderStatus("No API key", "error");
      document.getElementById("metrics").innerHTML =
        `<div class="metric-card" style="grid-column:1/-1">
           <div class="metric-label">Enter your FRED API key above to load live cost indices.</div>
         </div>`;
      return;
    }
    await this.load();
  },

  saveKey() {
    const val = document.getElementById("api-key-input").value.trim();
    if (!val) return;
    saveApiKey(val);
    document.getElementById("api-key-banner").classList.remove("visible");
    this.load();
  },

  async load() {
    renderStatus("Loading...", "");
    document.getElementById("index-body").innerHTML =
      `<tr><td colspan="6" class="state-msg skeleton">Fetching FRED indices...</td></tr>`;

    try {
      const ids    = ESTIMATE_INDICES.map(i => i.id);
      marketData   = await fetchAllSummaries(ids);

      activeChartId = activeChartId || ids[0];

      renderStatus("Live — FRED data", "connected");
      renderMetrics();
      renderIndexGrid();
      renderChart(activeChartId);
      renderTable();
      recalcBid(); // recalc with real data now loaded

    } catch (err) {
      renderStatus("Error", "error");
      document.getElementById("metrics").innerHTML =
        `<div class="metric-card" style="grid-column:1/-1;color:var(--text-danger)">${err.message}</div>`;
      document.getElementById("index-body").innerHTML =
        `<tr><td colspan="6" class="state-msg" style="color:var(--text-danger)">${err.message}</td></tr>`;
    }
  },

  refresh() { sessionStorage.clear(); this.load(); }
};

document.addEventListener("DOMContentLoaded", () => app.init());
