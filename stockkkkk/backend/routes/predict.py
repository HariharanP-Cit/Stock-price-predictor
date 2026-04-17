"""
POST /api/predict
Accepts symbol + days, returns LSTM/statistical price forecast.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, validator
from typing import Optional, List

from services.stock_service import fetch_historical_data, INDIAN_STOCKS
from models.lstm_model import predict_future

router = APIRouter()


class PredictRequest(BaseModel):
    symbol: str = Field(..., example="TCS.NS", description="Yahoo Finance ticker symbol")
    days: int   = Field(30, ge=1, le=365, description="Number of days to forecast")
    period: str = Field("2y", description="Historical data window for training: 1y, 2y, 5y")

    @validator("symbol")
    def symbol_uppercase(cls, v):
        return v.strip().upper()

    @validator("period")
    def valid_period(cls, v):
        allowed = {"1y", "2y", "5y", "3y"}
        if v not in allowed:
            raise ValueError(f"period must be one of {allowed}")
        return v


class PredictResponse(BaseModel):
    symbol: str
    name: str
    method: str
    last_actual_price: float
    predicted_prices: List[float]
    prediction_dates: List[str]
    days: int
    predicted_final_price: float
    expected_pct_change: float
    direction: str
    historical_dates: List[str]
    historical_prices: List[float]


@router.post("/predict", response_model=PredictResponse)
async def predict(req: PredictRequest):
    """
    Run LSTM price prediction for a given stock.
    Returns both historical and forecasted price series for charting.
    """
    df = fetch_historical_data(req.symbol, period=req.period)
    if df is None or df.empty:
        raise HTTPException(
            status_code=404,
            detail=f"Could not fetch data for symbol '{req.symbol}'. "
                   "Ensure it is a valid Yahoo Finance ticker (e.g., TCS.NS)."
        )

    result = predict_future(req.symbol, df, days=req.days)

    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    # Historical series for the chart (last 180 days)
    hist_df   = df.tail(180)
    hist_dates  = list(hist_df.index)
    hist_prices = [round(float(p), 2) for p in hist_df["Close"].values]

    name = INDIAN_STOCKS.get(req.symbol, {}).get("name", req.symbol)

    return PredictResponse(
        symbol=req.symbol,
        name=name,
        historical_dates=hist_dates,
        historical_prices=hist_prices,
        **result,
    )
