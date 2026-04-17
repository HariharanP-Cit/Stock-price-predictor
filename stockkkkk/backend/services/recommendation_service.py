"""
Recommendation Service
Suggests Indian stocks and allocates capital based on user preferences.
"""

import numpy as np
from typing import Dict, List, Optional
from services.stock_service import INDIAN_STOCKS, fetch_historical_data
from services.risk_service  import compute_risk_metrics, rank_stocks_by_risk_adjusted_return

# ── Risk-horizon matrix ────────────────────────────────────────────────────────
RISK_PROFILES = {
    "Low":    {"max_vol": 25, "min_sharpe": 0.3,  "preferred_sectors": ["Banking", "FMCG", "Utilities", "Pharma"]},
    "Medium": {"max_vol": 40, "min_sharpe": 0.0,  "preferred_sectors": ["IT", "Finance", "Telecom", "Consumer Goods"]},
    "High":   {"max_vol": 99, "min_sharpe": -99,  "preferred_sectors": ["Energy", "Infrastructure", "Automobile", "Healthcare"]},
}

HORIZON_MIN_HOLDING = {
    "short": 30,   # days
    "mid":   180,
    "long":  365,
}

# Default watchlist shown on dashboard
DEFAULT_WATCHLIST = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS",
    "WIPRO.NS", "SBIN.NS", "BAJFINANCE.NS",
]


def recommend_stocks(
    capital: float,
    risk_tolerance: str,  # Low | Medium | High
    horizon: str,         # short | mid | long
    manual_symbols: Optional[List[str]] = None,
) -> Dict:
    """
    Core recommendation engine.
    1. Filter stocks by risk profile
    2. Score by Sharpe ratio
    3. Allocate capital using inverse-volatility weights
    """
    profile   = RISK_PROFILES.get(risk_tolerance, RISK_PROFILES["Medium"])
    candidates = manual_symbols if manual_symbols else list(INDIAN_STOCKS.keys())

    # ── Fetch metrics for all candidates ──────────────────────────────────────
    metrics_list = []
    for symbol in candidates:
        df = fetch_historical_data(symbol, period="1y")
        if df is None:
            continue
        m = compute_risk_metrics(df, symbol)
        if "error" not in m:
            m["symbol"] = symbol
            m["name"]   = INDIAN_STOCKS.get(symbol, {}).get("name", symbol)
            m["sector"] = INDIAN_STOCKS.get(symbol, {}).get("sector", "N/A")
            metrics_list.append(m)

    if not metrics_list:
        return {"error": "Could not fetch market data. Please try again."}

    # ── Filter by risk tolerance ───────────────────────────────────────────────
    filtered = [
        m for m in metrics_list
        if m["volatility"] <= profile["max_vol"]
        and m["sharpe_ratio"] >= profile["min_sharpe"]
    ]

    # Sector preference boost (but don't drop others if nothing fits)
    sector_boost = [m for m in filtered if m["sector"] in profile["preferred_sectors"]]
    if len(sector_boost) >= 3:
        filtered = sector_boost

    # ── Rank by Sharpe ratio ───────────────────────────────────────────────────
    ranked = rank_stocks_by_risk_adjusted_return(filtered)
    top_n  = min(8, len(ranked))
    top    = ranked[:top_n]

    if not top:
        return {"error": "No suitable stocks found for your risk profile."}

    # ── Inverse-volatility allocation ─────────────────────────────────────────
    vols = np.array([max(m["volatility"], 0.1) for m in top])
    inv_vol = 1.0 / vols
    weights = inv_vol / inv_vol.sum()

    allocations = []
    for i, m in enumerate(top):
        weight   = float(weights[i])
        amount   = round(capital * weight, 2)
        # Approximate shares (whole numbers only)
        price    = m["current_price"]
        shares   = int(amount // price) if price > 0 else 0
        actual   = round(shares * price, 2)

        allocations.append({
            "symbol":           m["symbol"],
            "name":             m["name"],
            "sector":           m["sector"],
            "weight_pct":       round(weight * 100, 2),
            "amount_inr":       actual,
            "shares":           shares,
            "current_price":    m["current_price"],
            "expected_return":  m["expected_return"],
            "volatility":       m["volatility"],
            "sharpe_ratio":     m["sharpe_ratio"],
            "risk_level":       m["risk_level"],
        })

    total_invested  = sum(a["amount_inr"] for a in allocations)
    cash_remaining  = round(capital - total_invested, 2)

    # ── Portfolio summary ──────────────────────────────────────────────────────
    avg_return = float(np.average(
        [a["expected_return"] for a in allocations],
        weights=[a["weight_pct"] for a in allocations],
    ))
    avg_vol = float(np.average(
        [a["volatility"] for a in allocations],
        weights=[a["weight_pct"] for a in allocations],
    ))

    return {
        "capital":         capital,
        "risk_tolerance":  risk_tolerance,
        "horizon":         horizon,
        "total_invested":  round(total_invested, 2),
        "cash_remaining":  cash_remaining,
        "num_stocks":      len(allocations),
        "avg_return":      round(avg_return, 2),
        "avg_volatility":  round(avg_vol, 2),
        "allocations":     allocations,
        "note":            f"Allocation based on inverse-volatility weighting for {risk_tolerance} risk profile.",
    }
