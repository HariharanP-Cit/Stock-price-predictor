/**
 * api.js – Centralised API client for StockAI frontend.
 * All fetch calls go through this module.
 */

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8000/api'
  : '/api'; // same-origin in production

const DEFAULT_TIMEOUT = 60000; // 60s for long LSTM calls

// ── Utility: fetch with timeout ─────────────────────────────────────────────
async function fetchWithTimeout(url, options = {}, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    if (err.name === 'AbortError') throw new Error('Request timed out. The server may be starting up – please try again.');
    throw err;
  }
}

async function apiGet(path, params = {}) {
  const qs   = new URLSearchParams(params).toString();
  const url  = `${API_BASE}${path}${qs ? '?' + qs : ''}`;
  const res  = await fetchWithTimeout(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API error: ${res.status}`);
  }
  return res.json();
}

async function apiPost(path, body = {}) {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API error: ${res.status}`);
  }
  return res.json();
}

// ── Public API ───────────────────────────────────────────────────────────────

const StockAPI = {
  /** GET /stocks */
  getStocks(params = {}) { return apiGet('/stocks', params); },

  /** GET /stocks/sectors */
  getSectors() { return apiGet('/stocks/sectors'); },

  /** GET /stocks/:symbol */
  getStock(symbol) { return apiGet(`/stocks/${symbol}`); },

  /** GET /dashboard */
  getDashboard(symbols = null) {
    const params = symbols ? { symbols: symbols.join(',') } : {};
    return apiGet('/dashboard', params);
  },

  /** GET /dashboard/history/:symbol */
  getHistory(symbol, period = '6mo') {
    return apiGet(`/dashboard/history/${symbol}`, { period });
  },

  /** GET /dashboard/risk/:symbol */
  getRisk(symbol) { return apiGet(`/dashboard/risk/${symbol}`); },

  /** POST /predict */
  predict(symbol, days = 30, period = '2y') {
    return apiPost('/predict', { symbol, days, period });
  },

  /** POST /recommend */
  recommend(capital, riskTolerance, horizon, manualSymbols = null) {
    const body = { capital, risk_tolerance: riskTolerance, horizon };
    if (manualSymbols && manualSymbols.length > 0) body.manual_symbols = manualSymbols;
    return apiPost('/recommend', body);
  },
};

window.StockAPI = StockAPI;
