import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

load_dotenv()

from routes.predict import router as predict_router
from routes.recommend import router as recommend_router
from routes.dashboard import router as dashboard_router
from routes.stocks import router as stocks_router

app = FastAPI(
    title="AI Investment Predictor API",
    description="Full-stack stock prediction & portfolio recommendation system powered by LSTM",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(predict_router,   prefix="/api", tags=["Prediction"])
app.include_router(recommend_router, prefix="/api", tags=["Recommendation"])
app.include_router(dashboard_router, prefix="/api", tags=["Dashboard"])
app.include_router(stocks_router,    prefix="/api", tags=["Stocks"])


@app.get("/", tags=["Health"])
async def root():
    return {"message": "AI Investment Predictor API", "status": "running", "version": "1.0.0"}


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
