/**
 * dashboard.js – All interactive logic for dashboard.html
 */

'use strict';

Chart.defaults.color       = '#64748b';
Chart.defaults.borderColor = '#1e293b';
Chart.defaults.font.family = 'Inter, sans-serif';

/* ─── State ──────────────────────────────────────────────────────────────── */
let allStocks       = [];
let dashboardData   = null;
let priceChartInst  = null;
let predChartInst   = null;
let riskChartInst   = null;
let currentPeriod   = '1mo';
let currentChartSym = '';
let refreshInterval = null;
const WATCHLIST_KEY = 'stockai_watchlist';

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const fmt    = n  => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
const fmtINR = n  => '₹' + fmt(n);
const pct    = n  => (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%';
const clr    = n  => Number(n) >= 0 ? 'text-gain' : 'text-loss';
const clrBg  = n  => Number(n) >= 0 ? 'bg-gain'   : 'bg-loss';

function showToast(msg, type = 'info') {
  const colors = { info: '#6366f1', success: '#10b981', error: '#ef4444' };
  const t = document.createElement('div');
  t.className = 'fixed bottom-6 right-6 z-[9999] px-5 py-3 rounded-2xl text-white text-sm font-semibold shadow-2xl transition';
  t.style.background = colors[type] || colors.info;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function setBtn(btnId, spinnerId, textId, loading, label = '') {
  const btn = document.getElementById(btnId);
  const sp  = document.getElementById(spinnerId);
  const tx  = document.getElementById(textId);
  if (!btn) return;
  btn.disabled = loading;
  sp?.classList.toggle('hidden', !loading);
  if (tx && label) tx.textContent = label;
}

function updateLastUpdated() {
  const el = document.getElementById('lastUpdated');
  if (el) el.textContent = 'Updated ' + new Date().toLocaleTimeString('en-IN');
}

/* ─── Populate dropdowns ─────────────────────────────────────────────────── */
async function populateDropdowns() {
  try {
    const { stocks } = await StockAPI.getStocks();
    allStocks = stocks;

    const ids = ['chartSymbol','predSymbol','riskSymbol','watchlistAddSym','sidebarSymbol'];
    ids.forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = '';
      stocks.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.symbol;
        opt.textContent = `${s.symbol.replace('.NS','')} – ${s.name}`;
        sel.appendChild(opt);
      });
    });

    currentChartSym = stocks[0]?.symbol || 'TCS.NS';
    document.getElementById('chartSymbol').value = currentChartSym;
    loadPriceChart(currentChartSym, currentPeriod);
  } catch (e) {
    console.error('[dropdown]', e);
  }
}

/* ─── Ticker Tape ────────────────────────────────────────────────────────── */
function renderTickerTape(quotes) {
  const el = document.getElementById('tickerTape');
  if (!el || !quotes) return;

  const inner = quotes.map(q => {
    const sign = q.change_pct >= 0 ? '+' : '';
    const col  = q.change_pct >= 0 ? '#34d399' : '#f87171';
    return `<span class="text-xs font-mono" style="color:#94a3b8">
      ${q.symbol.replace('.NS','')} <strong style="color:white">₹${fmt(q.price)}</strong>
      <span style="color:${col}">${sign}${q.change_pct.toFixed(2)}%</span>
    </span>`;
  }).join('');

  // Duplicate for seamless loop
  el.innerHTML = inner + inner;
}

/* ─── Overview section ──────────────────────────────────────────────────── */
function renderOverview(data) {
  dashboardData = data;

  document.getElementById('advancingCount').textContent = data.advancing;
  document.getElementById('decliningCount').textContent = data.declining;
  document.getElementById('neutralCount').textContent   = data.neutral;
  document.getElementById('totalCount').textContent     = data.total;

  const badge = document.getElementById('sentimentBadge');
  const sentColors = { Bullish: 'text-gain border-green-500/40 bg-green-500/10', Bearish: 'text-loss border-red-500/40 bg-red-500/10', Neutral: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10' };
  badge.className   = `px-4 py-1.5 rounded-full text-sm font-bold border ${sentColors[data.sentiment] || ''}`;
  badge.textContent = `${data.sentiment === 'Bullish' ? '🐂' : data.sentiment === 'Bearish' ? '🐻' : '⚖️'} ${data.sentiment}`;

  renderMoverList('gainersList', data.gainers, true);
  renderMoverList('losersList',  data.losers,  false);
  renderTickerTape(data.quotes);
  renderLiveTracker(data.quotes);
  updateLastUpdated();
}

function renderMoverList(containerId, list, isGain) {
  const el  = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = list.map(q => `
    <div class="flex items-center justify-between py-2 border-b border-surface last:border-0">
      <div>
        <p class="font-semibold text-sm text-white">${q.symbol.replace('.NS','')}</p>
        <p class="text-xs text-slate-500">${q.name}</p>
      </div>
      <div class="text-right">
        <p class="font-bold text-sm text-white">${fmtINR(q.price)}</p>
        <p class="text-xs font-semibold ${isGain ? 'text-gain' : 'text-loss'}">${pct(q.change_pct)}</p>
      </div>
    </div>`).join('');
}

/* ─── Live Tracker Table ─────────────────────────────────────────────────── */
function renderLiveTracker(quotes, filter = '') {
  const tbody = document.getElementById('liveTrackerBody');
  if (!tbody) return;

  const filtered = filter
    ? quotes.filter(q => q.symbol.toLowerCase().includes(filter) || q.name.toLowerCase().includes(filter))
    : quotes;

  tbody.innerHTML = filtered.map(q => `
    <tr data-sym="${q.symbol}">
      <td>
        <p class="font-bold text-white text-sm">${q.symbol}</p>
        <p class="text-xs text-slate-500">${q.name}</p>
      </td>
      <td class="text-right font-mono font-bold text-white">${fmtINR(q.price)}</td>
      <td class="text-right ${clr(q.change)} font-semibold">${q.change >= 0 ? '+' : ''}${fmtINR(q.change)}</td>
      <td class="text-right">
        <span class="px-2 py-0.5 rounded-full text-xs font-bold ${clrBg(q.change_pct)} ${clr(q.change_pct)}">${pct(q.change_pct)}</span>
      </td>
      <td class="text-right text-slate-400 font-mono text-xs">${(q.volume / 1e5).toFixed(1)}L</td>
      <td class="text-right font-mono text-xs text-slate-300">${fmtINR(q.high)}</td>
      <td class="text-right font-mono text-xs text-slate-300">${fmtINR(q.low)}</td>
      <td class="text-center">
        <button onclick="quickChart('${q.symbol}')"
          class="px-3 py-1 rounded-lg bg-primary/15 text-primary text-xs font-semibold hover:bg-primary/30 transition">
          Chart
        </button>
      </td>
    </tr>`).join('');
}

document.getElementById('trackerSearch')?.addEventListener('input', e => {
  if (dashboardData?.quotes) renderLiveTracker(dashboardData.quotes, e.target.value.toLowerCase());
});

function quickChart(symbol) {
  document.getElementById('chartSymbol').value = symbol;
  currentChartSym = symbol;
  loadPriceChart(symbol, currentPeriod);
  document.getElementById('chart').scrollIntoView({ behavior: 'smooth' });
}
window.quickChart = quickChart;

/* ─── Price Chart ───────────────────────────────────────────────────────── */
async function loadPriceChart(symbol, period) {
  currentChartSym = symbol;
  currentPeriod   = period;
  document.getElementById('chartSubtitle').textContent = `${symbol} · ${period.toUpperCase()} history`;

  try {
    const data = await StockAPI.getHistory(symbol, period);
    if (priceChartInst) priceChartInst.destroy();

    priceChartInst = new Chart(document.getElementById('mainPriceChart'), {
      type: 'line',
      data: {
        labels:   data.dates,
        datasets: [
          {
            label:           'Close',
            data:            data.close,
            borderColor:     '#6366f1',
            backgroundColor: 'rgba(99,102,241,0.08)',
            borderWidth:     2,
            pointRadius:     0,
            fill:            true,
            tension:         0.3,
          },
          {
            label:      'High',
            data:       data.high,
            borderColor:'#10b981',
            borderWidth: 1,
            pointRadius: 0,
            borderDash:  [4, 4],
            fill:        false,
          },
          {
            label:      'Low',
            data:       data.low,
            borderColor:'#f87171',
            borderWidth: 1,
            pointRadius: 0,
            borderDash:  [4, 4],
            fill:        false,
          },
        ],
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend:  { labels: { usePointStyle: true, padding: 16 } },
          tooltip: { backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1,
                     callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtINR(ctx.parsed.y)}` } },
        },
        scales: {
          x: { ticks: { maxTicksLimit: 8, maxRotation: 0 }, grid: { color: '#1e293b' } },
          y: { ticks: { callback: v => '₹' + fmt(v) }, grid: { color: '#1e293b' } },
        },
      },
    });
  } catch (e) {
    showToast('Failed to load chart: ' + e.message, 'error');
  }
}

// Period buttons
document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadPriceChart(currentChartSym, btn.dataset.period);
  });
});

document.getElementById('chartSymbol')?.addEventListener('change', e => {
  currentChartSym = e.target.value;
  loadPriceChart(currentChartSym, currentPeriod);
});

/* ─── AI Prediction ─────────────────────────────────────────────────────── */
document.getElementById('runPredBtn')?.addEventListener('click', async () => {
  const symbol = document.getElementById('predSymbol').value;
  const days   = parseInt(document.getElementById('predDays').value);
  if (!symbol) return;

  setBtn('runPredBtn', 'predSpinner', 'predBtnText', true, 'Predicting…');
  document.getElementById('predResults').classList.add('hidden');
  document.getElementById('predError').classList.add('hidden');
  document.getElementById('predLoading').classList.remove('hidden');

  try {
    const data = await StockAPI.predict(symbol, days);
    document.getElementById('predLoading').classList.add('hidden');

    // Stats
    const statEl = document.getElementById('predStats');
    const stats  = [
      ['Last Price',      fmtINR(data.last_actual_price),      'text-white'],
      ['Forecast',        fmtINR(data.predicted_final_price),  'text-indigo-400'],
      ['Expected Return', pct(data.expected_pct_change),       data.expected_pct_change >= 0 ? 'text-gain' : 'text-loss'],
      ['Direction',       data.direction === 'UP' ? '📈 UP' : '📉 DOWN', data.expected_pct_change >= 0 ? 'text-gain' : 'text-loss'],
    ];
    statEl.innerHTML = stats.map(([l, v, c]) => `
      <div class="stat-card">
        <p class="text-xs text-slate-500 mb-1">${l}</p>
        <p class="font-bold text-sm ${c}">${v}</p>
      </div>`).join('');

    // Chart
    if (predChartInst) predChartInst.destroy();
    const el       = document.getElementById('predChart');
    const hLen     = data.historical_dates.length;
    const fLen     = data.prediction_dates.length;
    const allDates = [...data.historical_dates, ...data.prediction_dates];

    predChartInst = new Chart(el, {
      type: 'line',
      data: {
        labels:   allDates,
        datasets: [
          {
            label:           'Historical',
            data:            [...data.historical_prices, ...Array(fLen).fill(null)],
            borderColor:     '#6366f1',
            backgroundColor: 'rgba(99,102,241,0.06)',
            borderWidth:     2, pointRadius: 0, fill: true, tension: 0.3,
          },
          {
            label:           'LSTM Forecast',
            data:            [...Array(hLen - 1).fill(null), data.historical_prices.at(-1), ...data.predicted_prices],
            borderColor:     '#10b981',
            backgroundColor: 'rgba(16,185,129,0.06)',
            borderDash:      [6, 3],
            borderWidth:     2, pointRadius: 0, fill: true, tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend:  { labels: { usePointStyle: true, padding: 16 } },
          tooltip: { backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1,
                     callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtINR(ctx.parsed.y)}` } },
        },
        scales: {
          x: { ticks: { maxTicksLimit: 10, maxRotation: 0 }, grid: { color: '#1e293b' } },
          y: { ticks: { callback: v => '₹' + fmt(v)        }, grid: { color: '#1e293b' } },
        },
      },
    });

    document.getElementById('predResults').classList.remove('hidden');
  } catch (e) {
    document.getElementById('predLoading').classList.add('hidden');
    document.getElementById('predError').textContent = e.message;
    document.getElementById('predError').classList.remove('hidden');
    showToast(e.message, 'error');
  } finally {
    setBtn('runPredBtn', 'predSpinner', 'predBtnText', false, 'Run Prediction');
  }
});

/* ─── Risk Analysis ─────────────────────────────────────────────────────── */
document.getElementById('runRiskBtn')?.addEventListener('click', async () => {
  const symbol = document.getElementById('riskSymbol').value;
  if (!symbol) return;

  setBtn('runRiskBtn', 'riskSpinner', null, true);
  document.getElementById('riskResults').classList.add('hidden');

  try {
    const d = await StockAPI.getRisk(symbol);

    const meters = [
      ['Current Price',   fmtINR(d.current_price),       'text-white'],
      ['Expected Return', `${d.expected_return}%`,        d.expected_return >= 0 ? 'text-gain' : 'text-loss'],
      ['Volatility',      `${d.volatility}%`,             'text-yellow-400'],
      ['Sharpe Ratio',    d.sharpe_ratio.toFixed(3),      d.sharpe_ratio > 1 ? 'text-gain' : d.sharpe_ratio > 0 ? 'text-yellow-400' : 'text-loss'],
      ['Max Drawdown',    `${d.max_drawdown}%`,           'text-red-400'],
      ['VaR (95%)',       `${d.var_95}%`,                 'text-orange-400'],
      ['30-day Return',   `${d.recent_30d_return}%`,      d.recent_30d_return >= 0 ? 'text-gain' : 'text-loss'],
      ['Risk Level',      d.risk_level,                   `badge-${d.risk_level.toLowerCase()} px-2 py-0.5 rounded-full text-xs`],
    ];

    document.getElementById('riskStats').innerHTML = meters.map(([l, v, c]) => `
      <div class="stat-card">
        <p class="text-xs text-slate-500 mb-1">${l}</p>
        <p class="font-bold text-sm ${c}">${v}</p>
      </div>`).join('');

    // Gauge / bar chart
    if (riskChartInst) riskChartInst.destroy();
    riskChartInst = new Chart(document.getElementById('riskGauge'), {
      type: 'bar',
      data: {
        labels: ['Return %', 'Volatility %', 'Sharpe ×10', 'Drawdown %', 'VaR 95%'],
        datasets: [{
          label: symbol,
          data: [
            d.expected_return,
            d.volatility,
            d.sharpe_ratio * 10,
            Math.abs(d.max_drawdown),
            Math.abs(d.var_95),
          ],
          backgroundColor: ['#6366f1','#f59e0b','#10b981','#ef4444','#f97316'],
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: '#1e293b' } },
          y: { grid: { color: '#1e293b' } },
        },
      },
    });

    document.getElementById('riskResults').classList.remove('hidden');
  } catch (e) {
    showToast('Risk analysis failed: ' + e.message, 'error');
  } finally {
    setBtn('runRiskBtn', 'riskSpinner', null, false);
  }
});

/* ─── Watchlist ──────────────────────────────────────────────────────────── */
function getWatchlist() {
  return JSON.parse(localStorage.getItem(WATCHLIST_KEY) || '[]');
}
function saveWatchlist(list) {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
}

async function renderWatchlist() {
  const list = getWatchlist();
  const el   = document.getElementById('watchlistContainer');
  if (!el) return;

  if (list.length === 0) {
    el.innerHTML = '<p class="text-slate-500 text-sm col-span-full text-center py-4">Your watchlist is empty. Add stocks above.</p>';
    return;
  }

  el.innerHTML = '<p class="text-slate-500 text-xs col-span-full">Loading…</p>';

  try {
    const quotes = dashboardData?.quotes?.filter(q => list.includes(q.symbol)) || [];
    // also try to load any not in dashboard
    const missing = list.filter(s => !quotes.find(q => q.symbol === s));

    el.innerHTML = [...quotes, ...missing.map(s => ({ symbol: s, name: s, price: null, change_pct: 0 }))].map(q => `
      <div class="watchlist-item">
        <div>
          <p class="font-bold text-sm text-white">${q.symbol.replace('.NS','')}</p>
          <p class="text-xs text-slate-500">${q.name || ''}</p>
        </div>
        <div class="text-right">
          ${q.price !== null ? `
            <p class="font-bold text-sm text-white">${fmtINR(q.price)}</p>
            <p class="text-xs ${clr(q.change_pct)}">${pct(q.change_pct)}</p>
          ` : '<p class="text-xs text-slate-600">—</p>'}
        </div>
        <button onclick="removeWatchlist('${q.symbol}')"
          class="ml-2 text-slate-600 hover:text-red-400 transition text-lg leading-none">×</button>
      </div>`).join('');
  } catch (_) {}
}

window.removeWatchlist = function(sym) {
  const list = getWatchlist().filter(s => s !== sym);
  saveWatchlist(list);
  renderWatchlist();
  showToast(`${sym} removed from watchlist`);
};

document.getElementById('watchlistAddBtn')?.addEventListener('click', () => {
  const sym  = document.getElementById('watchlistAddSym').value;
  if (!sym) return;
  const list = getWatchlist();
  if (list.includes(sym)) { showToast('Already in watchlist'); return; }
  saveWatchlist([...list, sym]);
  renderWatchlist();
  showToast(`${sym} added to watchlist ⭐`, 'success');
});

/* ─── Portfolio Builder (Dashboard) ─────────────────────────────────────── */
document.getElementById('portRunBtn')?.addEventListener('click', async () => {
  const capital = parseFloat(document.getElementById('portCapital').value);
  if (!capital || capital < 10000) { showToast('Minimum capital is ₹10,000', 'error'); return; }

  const risk    = document.getElementById('portRisk').value;
  const horizon = document.getElementById('portHorizon').value;

  setBtn('portRunBtn', 'portSpinner', 'portBtnText', true, 'Analysing…');
  document.getElementById('portResults').classList.add('hidden');

  try {
    const data = await StockAPI.recommend(capital, risk, horizon);
    const el   = document.getElementById('portResults');

    el.innerHTML = `
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div class="stat-card"><p class="text-xs text-slate-500 mb-1">Invested</p><p class="font-bold text-white">${fmtINR(data.total_invested)}</p></div>
        <div class="stat-card"><p class="text-xs text-slate-500 mb-1">Remaining</p><p class="font-bold text-slate-300">${fmtINR(data.cash_remaining)}</p></div>
        <div class="stat-card"><p class="text-xs text-slate-500 mb-1">Avg Return</p><p class="font-bold text-gain">${data.avg_return}%</p></div>
        <div class="stat-card"><p class="text-xs text-slate-500 mb-1">Avg Vol</p><p class="font-bold text-yellow-400">${data.avg_volatility}%</p></div>
      </div>
      <div class="overflow-x-auto rounded-2xl border border-surface-border">
        <table class="w-full stock-table min-w-[600px]">
          <thead class="bg-surface">
            <tr>
              <th class="text-left">Stock</th>
              <th class="text-right">Price</th>
              <th class="text-right">Shares</th>
              <th class="text-right">Amount</th>
              <th class="text-right">Weight</th>
              <th class="text-right">Exp. Return</th>
              <th class="text-right">Risk</th>
            </tr>
          </thead>
          <tbody>
            ${data.allocations.map(a => `
              <tr>
                <td><p class="font-bold text-white text-sm">${a.symbol}</p><p class="text-xs text-slate-500">${a.sector}</p></td>
                <td class="text-right font-mono">${fmtINR(a.current_price)}</td>
                <td class="text-right">${a.shares}</td>
                <td class="text-right font-semibold">${fmtINR(a.amount_inr)}</td>
                <td class="text-right text-primary font-bold">${a.weight_pct}%</td>
                <td class="text-right ${a.expected_return >= 0 ? 'text-gain' : 'text-loss'}">${a.expected_return}%</td>
                <td class="text-right"><span class="badge-${a.risk_level.toLowerCase()} px-2 py-0.5 rounded-full text-xs font-bold">${a.risk_level}</span></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    el.classList.remove('hidden');
    showToast('Portfolio built successfully!', 'success');
  } catch (e) {
    showToast('Portfolio error: ' + e.message, 'error');
  } finally {
    setBtn('portRunBtn', 'portSpinner', 'portBtnText', false, '🚀 Build Portfolio');
  }
});

/* ─── Sidebar quick predict ─────────────────────────────────────────────── */
document.getElementById('sidebarPredictBtn')?.addEventListener('click', () => {
  const sym = document.getElementById('sidebarSymbol').value;
  if (!sym) return;
  document.getElementById('predSymbol').value = sym;
  document.getElementById('prediction').scrollIntoView({ behavior: 'smooth' });
  document.getElementById('runPredBtn').click();
});

/* ─── Refresh ────────────────────────────────────────────────────────────── */
async function loadDashboard() {
  try {
    const data = await StockAPI.getDashboard();
    renderOverview(data);
    renderWatchlist();
  } catch (e) {
    showToast('Failed to load dashboard: ' + e.message, 'error');
  }
}

document.getElementById('refreshBtn')?.addEventListener('click', loadDashboard);

/* ─── Init ──────────────────────────────────────────────────────────────── */
(async () => {
  await populateDropdowns();
  await loadDashboard();

  // Auto-refresh every 2 minutes
  refreshInterval = setInterval(loadDashboard, 120_000);
})();
