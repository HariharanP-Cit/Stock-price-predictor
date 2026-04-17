"""
GET /api/stocks
Returns the full catalogue of supported Indian stocks.
"""

from fastapi import APIRouter, Query
from typing import Optional

from services.stock_service import get_stock_list, INDIAN_STOCKS

router = APIRouter()


@router.get("/stocks")
async def list_stocks(
    sector: Optional[str] = Query(None, description="Filter by sector name"),
    search: Optional[str] = Query(None, description="Search by name or symbol"),
):
    """
    Returns the list of supported Indian stock tickers with metadata.
    Supports optional filtering by sector or search term.
    """
    stocks = get_stock_list()

    if sector:
        stocks = [s for s in stocks if s.get("sector", "").lower() == sector.lower()]

    if search:
        q = search.lower()
        stocks = [
            s for s in stocks
            if q in s["symbol"].lower() or q in s["name"].lower()
        ]

    return {
        "total": len(stocks),
        "stocks": stocks,
    }


@router.get("/stocks/sectors")
async def list_sectors():
    """Returns unique sectors available in the stock universe."""
    sectors = sorted({v["sector"] for v in INDIAN_STOCKS.values()})
    return {"sectors": sectors}


@router.get("/stocks/{symbol}")
async def get_stock(symbol: str):
    """Returns metadata for a single stock symbol."""
    symbol = symbol.upper()
    if symbol not in INDIAN_STOCKS:
        return {"error": f"Symbol '{symbol}' not in catalogue", "symbol": symbol}
    meta = INDIAN_STOCKS[symbol]
    return {"symbol": symbol, **meta}
