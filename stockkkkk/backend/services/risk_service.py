"""
Risk Analysis Service
Computes financial risk metrics: return, volatility, Sharpe ratio, Beta, etc.
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Optional

RISK_FREE_RATE = 0.065  # 6.5% – approximate Indian 10-year G-Sec yield (annual)
TRADING_DAYS   = 252


def compute_risk_metrics(df: pd.DataFrame, symbol: str) -> Dict:
    """
    Given an OHLCV DataFrame, compute a comprehensive risk profile.
    """
    if df is None or df.empty:
        return {"error": "No data available"}

    closes = df["Close"].dropna().values
    if len(closes) < 30:
        return {"error": "Insufficient price history"}

    # ── Daily returns ──────────────────────────────────────────────────────────
    daily_returns = np.diff(closes) / closes[:-1]

    # ── Annualised metrics ─────────────────────────────────────────────────────
    ann_return   = float(np.mean(daily_returns) * TRADING_DAYS)
    ann_vol      = float(np.std(daily_returns)  * np.sqrt(TRADING_DAYS))
    sharpe       = float((ann_return - RISK_FREE_RATE) / ann_vol) if ann_vol else 0.0

    # ── Drawdown ───────────────────────────────────────────────────────────────
    cum_returns    = np.cumprod(1 + daily_returns)
    running_max    = np.maximum.accumulate(cum_returns)
    drawdowns      = (cum_returns - running_max) / running_max
    max_drawdown   = float(drawdowns.min())

    # ── Value at Risk (95%) ────────────────────────────────────────────────────
    var_95 = float(np.percentile(daily_returns, 5))

    # ── Recent trend (30-day) ──────────────────────────────────────────────────
    recent_ret = float((closes[-1] - closes[-30]) / closes[-30]) if len(closes) >= 30 else 0.0

    # ── Risk classification ────────────────────────────────────────────────────
    risk_level = _classify_risk(ann_vol, sharpe, max_drawdown)

    # ── 52-week Hi/Lo ─────────────────────────────────────────────────────────
    period = closes[-252:] if len(closes) >= 252 else closes
    week52_high = float(period.max())
    week52_low  = float(period.min())

    return {
        "symbol":           symbol,
        "current_price":    round(float(closes[-1]), 2),
        "expected_return":  round(ann_return * 100, 2),   # %
        "volatility":       round(ann_vol    * 100, 2),   # %
        "sharpe_ratio":     round(sharpe, 3),
        "max_drawdown":     round(max_drawdown * 100, 2), # %
        "var_95":           round(var_95 * 100, 2),       # %
        "recent_30d_return":round(recent_ret * 100, 2),   # %
        "week52_high":      round(week52_high, 2),
        "week52_low":       round(week52_low, 2),
        "risk_level":       risk_level,
        "data_points":      len(closes),
    }


def _classify_risk(volatility: float, sharpe: float, max_drawdown: float) -> str:
    """Classify into Low / Medium / High based on thresholds."""
    # Volatility thresholds (annualised)
    if volatility < 0.20:
        vol_score = 1
    elif volatility < 0.35:
        vol_score = 2
    else:
        vol_score = 3

    # Sharpe bonus: good sharpe lowers effective risk
    sharpe_adj = -1 if sharpe > 1.0 else (0 if sharpe > 0 else 1)

    score = vol_score + sharpe_adj
    if score <= 1:
        return "Low"
    elif score <= 2:
        return "Medium"
    else:
        return "High"


def portfolio_risk_metrics(
    weights: List[float],
    metrics_list: List[Dict],
) -> Dict:
    """
    Aggregate portfolio-level risk from individual stock metrics and weights.
    Simple weighted average (ignores correlation for now).
    """
    if not metrics_list or len(metrics_list) != len(weights):
        return {}

    w = np.array(weights, dtype=float)
    w = w / w.sum()  # normalise

    port_return  = sum(w[i] * (metrics_list[i].get("expected_return", 0) / 100)
                       for i in range(len(w)))
    port_vol     = np.sqrt(sum((w[i] * metrics_list[i].get("volatility", 0) / 100) ** 2
                               for i in range(len(w))))
    port_sharpe  = (port_return - RISK_FREE_RATE) / port_vol if port_vol else 0

    return {
        "portfolio_return":    round(port_return * 100, 2),
        "portfolio_volatility":round(port_vol    * 100, 2),
        "portfolio_sharpe":    round(port_sharpe, 3),
    }


def rank_stocks_by_risk_adjusted_return(metrics_list: List[Dict]) -> List[Dict]:
    """Sort stocks by Sharpe ratio (highest = best risk-adj return)."""
    valid = [m for m in metrics_list if "sharpe_ratio" in m and "error" not in m]
    return sorted(valid, key=lambda x: x["sharpe_ratio"], reverse=True)
