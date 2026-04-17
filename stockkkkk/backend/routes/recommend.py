"""
POST /api/recommend
Accepts user investment profile, returns personalised stock recommendations.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, validator
from typing import Optional, List

from services.recommendation_service import recommend_stocks

router = APIRouter()


class RecommendRequest(BaseModel):
    capital: float         = Field(..., gt=0,  example=100000, description="Investment capital in INR")
    risk_tolerance: str    = Field("Medium",   example="Medium", description="Low | Medium | High")
    horizon: str           = Field("mid",      example="mid",    description="short | mid | long")
    manual_symbols: Optional[List[str]] = Field(None, description="Optional list of stock symbols to restrict universe")

    @validator("risk_tolerance")
    def valid_risk(cls, v):
        allowed = {"Low", "Medium", "High"}
        v = v.capitalize()
        if v not in allowed:
            raise ValueError(f"risk_tolerance must be one of {allowed}")
        return v

    @validator("horizon")
    def valid_horizon(cls, v):
        allowed = {"short", "mid", "long"}
        v = v.lower()
        if v not in allowed:
            raise ValueError(f"horizon must be one of {allowed}")
        return v

    @validator("manual_symbols", each_item=True, pre=True)
    def upper_symbols(cls, v):
        return v.strip().upper()


@router.post("/recommend")
async def recommend(req: RecommendRequest):
    """
    Returns a personalised stock portfolio recommendation with capital allocation.
    """
    result = recommend_stocks(
        capital=req.capital,
        risk_tolerance=req.risk_tolerance,
        horizon=req.horizon,
        manual_symbols=req.manual_symbols,
    )

    if "error" in result:
        raise HTTPException(status_code=503, detail=result["error"])

    return result
