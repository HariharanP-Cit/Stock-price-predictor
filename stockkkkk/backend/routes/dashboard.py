"""
GET /api/dashboard
Returns aggregated live market data + portfolio metrics for the dashboard.
"""

from fastapi import APIRouter, Query, HTTPException
from typing import List, Optional

from services.stock_service  import fetch_multiple_quotes, fetch_live_quote, INDIAN_STOCKS
from services.risk_service   import compute_risk_metrics, rank_stocks_by_risk_adjusted_return
from services.stock_service  import fetch_historical_data

router = APIRouter()

# Default set shown on dashboard
DEFAULT_DASHBOARD_SYMBOLS = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS",
    "ICICIBANK.NS", "WIPRO.NS", "SBIN.NS", "BAJFINANCE.NS",
    "BHARTIARTL.NS", "KOTAKBANK.NS",
]


@router.get("/dashboard")
async def get_dashboard(
    symbols: Optional[str] = Query(
        None,
        description="Comma-separated list of ticker symbols e.g. TCS.NS,INFY.NS"
    )
):
    """
    Returns live stock quotes, sector breakdown, and market movers.
    """
    if symbols:
        syms = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    else:
        syms = DEFAULT_DASHBOARD_SYMBOLS

    quotes = fetch_multiple_quotes(syms)

    if not quotes:
        raise HTTPException(status_code=503, detail="Market data unavailable. Please try again.")

    # ── Market movers ──────────────────────────────────────────────────────────
    gainers = sorted(quotes, key=lambda x: x["change_pct"], reverse=True)[:5]
    losers  = sorted(quotes, key=lambda x: x["change_pct"])[:5]

    # ── Sector breakdown ───────────────────────────────────────────────────────
    sector_map: dict = {}
    for q in quotes:
        sector = q.get("sector", "Other")
        sector_map[sector] = sector_map.get(sector, 0) + 1

    # ── Market sentiment ───────────────────────────────────────────────────────
    advancing = sum(1 for q in quotes if q["change_pct"] > 0)
    declining = sum(1 for q in quotes if q["change_pct"] < 0)
    neutral   = len(quotes) - advancing - declining
    sentiment = "Bullish" if advancing > declining else ("Bearish" if declining > advancing else "Neutral")

    return {
        "quotes":      quotes,
        "gainers":     gainers,
        "losers":      losers,
        "sector_map":  sector_map,
        "sentiment":   sentiment,
        "advancing":   advancing,
        "declining":   declining,
        "neutral":     neutral,
        "total":       len(quotes),
    }


@router.get("/dashboard/history/{symbol}")
async def get_stock_history(
    symbol: str,
    period: str = Query("6mo", description="1mo | 3mo | 6mo | 1y | 2y | 5y"),
):
    """
    Returns OHLCV history for a single symbol (used for the price chart).
    """
    symbol = symbol.upper()
    allowed_periods = {"1mo", "3mo", "6mo", "1y", "2y", "5y"}
    if period not in allowed_periods:
        raise HTTPException(status_code=400, detail=f"period must be one of {allowed_periods}")

    df = fetch_historical_data(symbol, period=period)
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No data found for {symbol}")

    return {
        "symbol": symbol,
        "name":   INDIAN_STOCKS.get(symbol, {}).get("name", symbol),
        "period": period,
        "dates":  list(df.index),
        "open":   [round(float(v), 2) for v in df["Open"].values],
        "close":  [round(float(v), 2) for v in df["Close"].values],
        "high":   [round(float(v), 2) for v in df["High"].values],
        "low":    [round(float(v), 2) for v in df["Low"].values],
        "volume": [int(v) for v in df["Volume"].values],
    }


@router.get("/dashboard/risk/{symbol}")
async def get_stock_risk(symbol: str):
    """Returns risk metrics for a single stock."""
    symbol = symbol.upper()
    df = fetch_historical_data(symbol, period="1y")
    if df is None:
        raise HTTPException(status_code=404, detail=f"No data for {symbol}")
    metrics = compute_risk_metrics(df, symbol)
    if "error" in metrics:
        raise HTTPException(status_code=500, detail=metrics["error"])
    return metrics
