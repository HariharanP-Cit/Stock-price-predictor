/**
 * main.js – Landing page logic
 * Handles: hero chart, advisor form, stock predictor, watchlist init
 */

'use strict';

/* ─── Chart.js global defaults ─────────────────────────────────────────── */
Chart.defaults.color          = '#64748b';
Chart.defaults.borderColor    = '#1e293b';
Chart.defaults.font.family    = 'Inter, sans-serif';

let heroChartInst = null;
let predictChartInst = null;

/* ─── Helpers ───────────────────────────────────────────────────────────── */
const fmt   = n  => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
const fmtINR = n => '₹' + fmt(n);
const pct   = n  => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
const clr   = n  => n >= 0 ? '#34d399' : '#f87171';

function showToast(msg, type = 'info') {
  const colors = { info: '#6366f1', success: '#10b981', error: '#ef4444' };
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-6 right-6 z-[9999] px-5 py-3 rounded-2xl text-white text-sm font-semibold shadow-2xl';
  toast.style.background = colors[type] || colors.info;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function setLoading(btn, spinner, text, isLoading, label = 'Loading…') {
  if (isLoading) {
    btn.disabled = true;
    spinner.classList.remove('hidden');
    text.textContent = label;
  } else {
    btn.disabled = false;
    spinner.classList.add('hidden');
  }
}

/* ─── Hero chart ─────────────────────────────────────────────────────────── */
async function loadHeroChart() {
  try {
    const data = await StockAPI.getHistory('TCS.NS', '6mo');
    const el   = document.getElementById('heroChart');
    if (!el) return;

    document.getElementById('heroPrice').textContent   = fmtINR(data.close.at(-1));
    const lastChg = data.close.at(-1) - data.close.at(-2);
    const lastPct = (lastChg / data.close.at(-2) * 100).toFixed(2);
    const el2 = document.getElementById('heroChange');
    el2.textContent = pct(parseFloat(lastPct));
    el2.className   = `px-3 py-1 rounded-full text-xs font-bold ${lastChg >= 0 ? 'bg-accent/10 text-accent' : 'bg-red-500/10 text-red-400'}`;

    if (heroChartInst) heroChartInst.destroy();
    heroChartInst = new Chart(el, {
      type: 'line',
      data: {
        labels:   data.dates,
        datasets: [{
          data:            data.close,
          borderColor:     '#6366f1',
          backgroundColor: 'rgba(99,102,241,0.08)',
          borderWidth:     2,
          pointRadius:     0,
          fill:            true,
          tension:         0.4,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
        scales: {
          x: { display: false },
          y: { display: false },
        },
      },
    });
  } catch (e) {
    console.warn('[hero]', e.message);
  }
}

/* ─── Populate predict symbol dropdown ─────────────────────────────────── */
async function populatePredictDropdown() {
  const sel = document.getElementById('predictSymbol');
  if (!sel) return;
  try {
    const { stocks } = await StockAPI.getStocks();
    stocks.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.symbol;
      opt.textContent = `${s.symbol} – ${s.name}`;
      sel.appendChild(opt);
    });
  } catch (_) {}
}

/* ─── Stock Predictor ───────────────────────────────────────────────────── */
function renderPredictChart(data) {
  const div    = document.getElementById('predictResult');
  const errDiv = document.getElementById('predictError');
  div.classList.remove('hidden');
  errDiv.classList.add('hidden');

  // Stats
  const statsEl = document.getElementById('predictStats');
  const stats    = [
    { label: 'Last Price',       value: fmtINR(data.last_actual_price), color: 'text-white'                   },
    { label: 'Predicted Price',  value: fmtINR(data.predicted_final_price), color: 'text-primary'              },
    { label: 'Expected Change',  value: pct(data.expected_pct_change),       color: clr(data.expected_pct_change)  },
    { label: 'Direction',        value: data.direction === 'UP' ? '📈 UP' : '📉 DOWN', color: clr(data.expected_pct_change) },
  ];
  statsEl.innerHTML = stats.map(s => `
    <div class="stat-card">
      <p class="text-xs text-slate-500 mb-1">${s.label}</p>
      <p class="font-bold text-base ${s.color}">${s.value}</p>
    </div>`).join('');

  // Chart
  const el = document.getElementById('predictChart');
  if (predictChartInst) predictChartInst.destroy();

  const histLabels = data.historical_dates;
  const predLabels = data.prediction_dates;
  const allLabels  = [...histLabels, ...predLabels];

  predictChartInst = new Chart(el, {
    type: 'line',
    data: {
      labels:   allLabels,
      datasets: [
        {
          label:            'Historical',
          data:             [...data.historical_prices, ...Array(predLabels.length).fill(null)],
          borderColor:      '#6366f1',
          backgroundColor:  'rgba(99,102,241,0.07)',
          borderWidth:      2,
          pointRadius:      0,
          fill:             true,
          tension:          0.3,
        },
        {
          label:            'LSTM Forecast',
          data:             [...Array(histLabels.length - 1).fill(null), data.historical_prices.at(-1), ...data.predicted_prices],
          borderColor:      '#10b981',
          backgroundColor:  'rgba(16,185,129,0.07)',
          borderWidth:      2,
          borderDash:       [6, 3],
          pointRadius:      0,
          fill:             true,
          tension:          0.3,
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { usePointStyle: true, pointStyle: 'circle', padding: 20 } },
        tooltip: { backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1 },
      },
      scales: {
        x: {
          ticks: { maxTicksLimit: 8, maxRotation: 0 },
          grid:  { color: '#1e293b' },
        },
        y: {
          ticks: { callback: v => '₹' + fmt(v) },
          grid:  { color: '#1e293b' },
        },
      },
    },
  });
}

document.getElementById('predictBtn')?.addEventListener('click', async () => {
  const symbol = document.getElementById('predictSymbol').value;
  const days   = parseInt(document.getElementById('predictDays').value);
  const btn    = document.getElementById('predictBtn');
  const spinner= document.getElementById('predictSpinner');
  const text   = document.getElementById('predictBtnText');
  const errDiv = document.getElementById('predictError');

  if (!symbol) return;

  setLoading(btn, spinner, text, true, 'Predicting…');
  errDiv.classList.add('hidden');
  document.getElementById('predictResult').classList.add('hidden');

  try {
    const data = await StockAPI.predict(symbol, days);
    renderPredictChart(data);
    text.textContent = 'Predict';
  } catch (e) {
    errDiv.textContent = e.message;
    errDiv.classList.remove('hidden');
    text.textContent = 'Predict';
    showToast(e.message, 'error');
  } finally {
    setLoading(btn, spinner, text, false);
    text.textContent = 'Predict';
  }
});

/* ─── Advisor form ──────────────────────────────────────────────────────── */
// Risk button toggle
document.querySelectorAll('.risk-btn input').forEach(radio => {
  radio.addEventListener('change', () => {
    document.querySelectorAll('.risk-btn span').forEach(span => {
      span.className = 'block py-3 rounded-xl border border-surface-border bg-surface text-center text-sm font-semibold hover:border-primary/60 transition text-slate-300';
    });
    const span = radio.nextElementSibling;
    span.className = 'block py-3 rounded-xl border border-primary bg-primary/15 text-center text-sm font-semibold text-indigo-300 transition';
  });
});

function renderAdvisorResults(data) {
  const div = document.getElementById('advisorResults');
  div.classList.remove('hidden');

  const up   = n => n >= 0 ? `<span class="text-gain">+${n}%</span>` : `<span class="text-loss">${n}%</span>`;
  const risk = r => `<span class="badge-${r.toLowerCase()} px-2 py-0.5 rounded-full text-xs font-bold">${r}</span>`;

  const pieData    = data.allocations.map(a => a.weight_pct);
  const pieLabels  = data.allocations.map(a => a.symbol.replace('.NS', ''));
  const pieColors  = ['#6366f1','#10b981','#f59e0b','#ec4899','#3b82f6','#8b5cf6','#ef4444','#06b6d4'];

  div.innerHTML = `
    <div class="border-t border-surface-border pt-8 mt-6">
      <h3 class="text-xl font-black mb-1">Your AI Portfolio</h3>
      <p class="text-slate-400 text-sm mb-6">${data.note}</p>

      <!-- Summary cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div class="stat-card">
          <p class="text-xs text-slate-500 mb-1">Total Invested</p>
          <p class="font-bold text-white">${fmtINR(data.total_invested)}</p>
        </div>
        <div class="stat-card">
          <p class="text-xs text-slate-500 mb-1">Cash Remaining</p>
          <p class="font-bold text-slate-300">${fmtINR(data.cash_remaining)}</p>
        </div>
        <div class="stat-card">
          <p class="text-xs text-slate-500 mb-1">Avg. Return</p>
          <p class="font-bold text-gain">${data.avg_return}%</p>
        </div>
        <div class="stat-card">
          <p class="text-xs text-slate-500 mb-1">Avg. Volatility</p>
          <p class="font-bold text-yellow-400">${data.avg_volatility}%</p>
        </div>
      </div>

      <!-- Pie + allocations row -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <div class="flex items-center justify-center">
          <canvas id="allocPie" width="220" height="220"></canvas>
        </div>
        <div class="space-y-3">
          ${data.allocations.map((a, i) => `
            <div>
              <div class="flex justify-between text-sm font-semibold mb-1">
                <span>${a.symbol.replace('.NS','')} <span class="text-slate-500 font-normal text-xs">${a.name}</span></span>
                <span class="text-slate-300">${a.weight_pct}%</span>
              </div>
              <div class="alloc-bar-track">
                <div class="alloc-bar-fill" style="width:${a.weight_pct}%; background:${pieColors[i % pieColors.length]}"></div>
              </div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Detailed table -->
      <div class="overflow-x-auto rounded-2xl border border-surface-border">
        <table class="w-full stock-table">
          <thead class="bg-surface-card">
            <tr>
              <th class="text-left">Stock</th>
              <th class="text-right">Price</th>
              <th class="text-right">Shares</th>
              <th class="text-right">Amount</th>
              <th class="text-right">Exp. Return</th>
              <th class="text-right">Volatility</th>
              <th class="text-right">Risk</th>
            </tr>
          </thead>
          <tbody>
            ${data.allocations.map(a => `
              <tr>
                <td>
                  <p class="font-semibold text-white">${a.symbol}</p>
                  <p class="text-xs text-slate-500">${a.sector}</p>
                </td>
                <td class="text-right font-mono">${fmtINR(a.current_price)}</td>
                <td class="text-right">${a.shares}</td>
                <td class="text-right font-semibold">${fmtINR(a.amount_inr)}</td>
                <td class="text-right">${up(a.expected_return)}</td>
                <td class="text-right text-yellow-400">${a.volatility}%</td>
                <td class="text-right">${risk(a.risk_level)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div class="mt-4 flex gap-3">
        <a href="dashboard.html" class="flex-1 py-3 rounded-xl bg-primary/15 border border-primary/40 text-primary text-center font-semibold text-sm hover:bg-primary/25 transition">
          View Dashboard →
        </a>
        <button onclick="window.print()" class="px-5 py-3 rounded-xl border border-surface-border text-slate-400 text-sm font-semibold hover:text-white transition">
          🖨️ Export
        </button>
      </div>
    </div>`;

  // Pie chart
  setTimeout(() => {
    const pieEl = document.getElementById('allocPie');
    if (!pieEl) return;
    new Chart(pieEl, {
      type: 'doughnut',
      data: {
        labels:   pieLabels,
        datasets: [{ data: pieData, backgroundColor: pieColors, borderColor: '#0f172a', borderWidth: 3 }],
      },
      options: {
        cutout: '65%',
        plugins: {
          legend: { position: 'bottom', labels: { padding: 12, font: { size: 11 } } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed.toFixed(1)}%` } },
        },
      },
    });
  }, 100);

  div.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.getElementById('advisorForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const capital = parseFloat(document.getElementById('capital').value);
  if (!capital || capital < 10000) {
    showToast('Please enter a minimum capital of ₹10,000', 'error'); return;
  }
  const risk    = document.querySelector('input[name="risk"]:checked')?.value || 'Medium';
  const horizon = document.getElementById('horizon').value;
  const raw     = document.getElementById('manualSymbols').value.trim();
  const manual  = raw ? raw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : null;

  const btn     = document.getElementById('advisorBtn');
  const spinner = document.getElementById('advisorSpinner');
  const text    = document.getElementById('advisorBtnText');

  setLoading(btn, spinner, text, true, 'Analysing market…');

  try {
    const data = await StockAPI.recommend(capital, risk, horizon, manual);
    renderAdvisorResults(data);
    showToast('Portfolio generated successfully!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setLoading(btn, spinner, text, false);
    text.textContent = '🚀 Generate AI Portfolio';
  }
});

/* ─── Init ──────────────────────────────────────────────────────────────── */
(async () => {
  await Promise.all([
    loadHeroChart(),
    populatePredictDropdown(),
  ]);
})();
