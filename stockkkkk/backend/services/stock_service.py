"""
Stock data service – fetches and processes data from Yahoo Finance.
"""

import yfinance as yf
import pandas as pd
import numpy as np
from typing import Dict, List, Optional
from utils.cache import get as cache_get, set as cache_set

# ── Known Indian stocks catalogue ─────────────────────────────────────────────
INDIAN_STOCKS: Dict[str, Dict] = {
    "RELIANCE.NS": {"name": "Reliance Industries",   "sector": "Energy",          "market_cap": "large"},
    "TCS.NS":      {"name": "Tata Consultancy Services", "sector": "IT",           "market_cap": "large"},
    "HDFCBANK.NS": {"name": "HDFC Bank",              "sector": "Banking",         "market_cap": "large"},
    "INFY.NS":     {"name": "Infosys",                "sector": "IT",              "market_cap": "large"},
    "ICICIBANK.NS":{"name": "ICICI Bank",             "sector": "Banking",         "market_cap": "large"},
    "HINDUNILVR.NS":{"name":"Hindustan Unilever",     "sector": "FMCG",            "market_cap": "large"},
    "SBIN.NS":     {"name": "State Bank of India",    "sector": "Banking",         "market_cap": "large"},
    "BAJFINANCE.NS":{"name":"Bajaj Finance",          "sector": "Finance",         "market_cap": "large"},
    "BHARTIARTL.NS":{"name":"Bharti Airtel",          "sector": "Telecom",         "market_cap": "large"},
    "KOTAKBANK.NS":{"name": "Kotak Mahindra Bank",    "sector": "Banking",         "market_cap": "large"},
    "WIPRO.NS":    {"name": "Wipro",                  "sector": "IT",              "market_cap": "large"},
    "LT.NS":       {"name": "Larsen & Toubro",        "sector": "Infrastructure",  "market_cap": "large"},
    "ASIANPAINT.NS":{"name":"Asian Paints",           "sector": "Consumer Goods",  "market_cap": "large"},
    "MARUTI.NS":   {"name": "Maruti Suzuki",          "sector": "Automobile",      "market_cap": "large"},
    "SUNPHARMA.NS":{"name": "Sun Pharmaceutical",     "sector": "Pharma",          "market_cap": "large"},
    "TITAN.NS":    {"name": "Titan Company",          "sector": "Consumer Goods",  "market_cap": "large"},
    "ULTRACEMCO.NS":{"name":"UltraTech Cement",       "sector": "Cement",          "market_cap": "large"},
    "NESTLEIND.NS":{"name": "Nestle India",           "sector": "FMCG",            "market_cap": "large"},
    "POWERGRID.NS":{"name": "Power Grid Corporation", "sector": "Utilities",       "market_cap": "large"},
    "NTPC.NS":     {"name": "NTPC",                   "sector": "Utilities",       "market_cap": "large"},
    "ONGC.NS":     {"name": "ONGC",                   "sector": "Energy",          "market_cap": "large"},
    "TECHM.NS":    {"name": "Tech Mahindra",          "sector": "IT",              "market_cap": "mid"},
    "HCLTECH.NS":  {"name": "HCL Technologies",       "sector": "IT",              "market_cap": "large"},
    "DIVISLAB.NS": {"name": "Divi's Laboratories",    "sector": "Pharma",          "market_cap": "large"},
    "DRREDDY.NS":  {"name": "Dr. Reddy's Labs",       "sector": "Pharma",          "market_cap": "large"},
    "ADANIPORTS.NS":{"name":"Adani Ports",            "sector": "Infrastructure",  "market_cap": "large"},
    "BAJAJFINSV.NS":{"name":"Bajaj Finserv",          "sector": "Finance",         "market_cap": "large"},
    "APOLLOHOSP.NS":{"name":"Apollo Hospitals",       "sector": "Healthcare",      "market_cap": "large"},
    "CIPLA.NS":    {"name": "Cipla",                  "sector": "Pharma",          "market_cap": "large"},
    "EICHERMOT.NS":{"name": "Eicher Motors",          "sector": "Automobile",      "market_cap": "large"},
}


def get_stock_list() -> List[Dict]:
    """Return catalogue of available Indian stocks."""
    result = []
    for symbol, meta in INDIAN_STOCKS.items():
        result.append({"symbol": symbol, **meta})
    return result


def fetch_historical_data(
    symbol: str,
    period: str = "2y",
    interval: str = "1d",
) -> Optional[pd.DataFrame]:
    """
    Download OHLCV data from Yahoo Finance.
    Returns a cleaned DataFrame indexed by Date string or None on failure.
    Compatible with yfinance 1.x and pandas 3.x.
    """
    cache_key = f"{symbol}_{period}_{interval}"
    cached = cache_get("hist", cache_key, ttl=3600)  # 1-hour cache
    if cached:
        try:
            return pd.DataFrame(cached)
        except Exception:
            pass

    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval=interval, auto_adjust=True)
        if df is None or df.empty:
            return None

        # Keep only OHLCV columns that exist
        cols = [c for c in ["Open", "Close", "High", "Low", "Volume"] if c in df.columns]
        df = df[cols].dropna()

        # Normalise index to string dates (handles both tz-aware and tz-naive)
        if hasattr(df.index, "tz") and df.index.tz is not None:
            df.index = df.index.tz_convert(None)
        df.index = df.index.strftime("%Y-%m-%d")

        cache_set("hist", cache_key, value=df.to_dict(), ttl=3600)
        return df
    except Exception as e:
        print(f"[stock_service] Error fetching {symbol}: {e}")
        return None


def fetch_live_quote(symbol: str) -> Optional[Dict]:
    """Fetch current price & change info for a symbol."""
    cached = cache_get("quote", symbol, ttl=60)  # 1-min cache
    if cached:
        return cached

    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="5d", interval="1d", auto_adjust=True)
        if hist is None or hist.empty or len(hist) < 2:
            return None

        prev_close = float(hist["Close"].iloc[-2])
        curr_close = float(hist["Close"].iloc[-1])
        if prev_close == 0:
            return None
        change_pct = ((curr_close - prev_close) / prev_close) * 100

        quote = {
            "symbol": symbol,
            "name": INDIAN_STOCKS.get(symbol, {}).get("name", symbol),
            "price": round(curr_close, 2),
            "prev_close": round(prev_close, 2),
            "change": round(curr_close - prev_close, 2),
            "change_pct": round(change_pct, 2),
            "volume": int(hist["Volume"].iloc[-1]) if "Volume" in hist.columns else 0,
            "high": round(float(hist["High"].iloc[-1]), 2) if "High" in hist.columns else round(curr_close, 2),
            "low": round(float(hist["Low"].iloc[-1]), 2) if "Low" in hist.columns else round(curr_close, 2),
            "open": round(float(hist["Open"].iloc[-1]), 2) if "Open" in hist.columns else round(curr_close, 2),
            "sector": INDIAN_STOCKS.get(symbol, {}).get("sector", "N/A"),
        }
        cache_set("quote", symbol, value=quote, ttl=60)
        return quote
    except Exception as e:
        print(f"[stock_service] Quote error for {symbol}: {e}")
        return None


def fetch_multiple_quotes(symbols: List[str]) -> List[Dict]:
    """Batch-fetch quotes for multiple symbols."""
    results = []
    for s in symbols:
        q = fetch_live_quote(s)
        if q:
            results.append(q)
    return results
