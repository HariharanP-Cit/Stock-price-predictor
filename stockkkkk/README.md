# StockAI – AI Investment Predictor & Stock Dashboard

> Full-stack, production-ready Indian stock market AI system with LSTM price prediction, risk analysis, portfolio recommendation, and a live interactive dashboard.

---

## 🛠️ Tech Stack

| Layer       | Technology                                      |
|-------------|------------------------------------------------|
| Backend     | FastAPI + Uvicorn                               |
| ML Engine   | TensorFlow / Keras (LSTM), Scikit-learn         |
| Data Source | Yahoo Finance (`yfinance`)                      |
| Frontend    | HTML5 + Tailwind CSS + Vanilla JS + Chart.js    |
| Deployment  | Docker / Docker Compose                         |

---

## 📁 Project Structure

```
stockkkkk/
├── backend/
│   ├── app.py                   ← FastAPI entry point
│   ├── routes/
│   │   ├── predict.py           ← POST /api/predict
│   │   ├── recommend.py         ← POST /api/recommend
│   │   ├── dashboard.py         ← GET  /api/dashboard
│   │   └── stocks.py            ← GET  /api/stocks
│   ├── services/
│   │   ├── stock_service.py     ← yfinance data fetching + caching
│   │   ├── risk_service.py      ← Sharpe, VaR, drawdown metrics
│   │   └── recommendation_service.py ← Portfolio allocation engine
│   ├── models/
│   │   └── lstm_model.py        ← LSTM build / train / predict
│   └── utils/
│       └── cache.py             ← TTL memory + disk cache
├── frontend/
│   ├── index.html               ← Landing page + advisor form
│   ├── dashboard.html           ← Live dashboard
│   ├── js/
│   │   ├── api.js               ← API client
│   │   ├── main.js              ← Landing page logic
│   │   └── dashboard.js         ← Dashboard logic
│   └── styles/
│       └── custom.css
├── model/                       ← Saved LSTM .keras models (auto-created)
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## 🚀 Quick Start (Local)

### 1. Clone & install dependencies

```bash
cd stockkkkk

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux/Mac

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure environment

```bash
copy .env.example .env          # Windows
# cp .env.example .env          # Linux/Mac
```

Edit `.env` if needed (default port is 8000).

### 3. Run the backend

```bash
cd backend
uvicorn app:app --reload --port 8000
```

API is now running at **http://localhost:8000**
- Swagger docs: http://localhost:8000/docs
- ReDoc:        http://localhost:8000/redoc

### 4. Open the frontend

Open `frontend/index.html` in a browser, or serve with any static server:

```bash
# Using Python
cd frontend
python -m http.server 3000
# Visit http://localhost:3000
```

---

## 🐳 Docker Deployment

```bash
# Build & run everything
docker-compose up --build

# Backend:  http://localhost:8000
# Frontend: http://localhost:3000
```

---

## ☁️ Cloud Deployment

### Backend → Render / Railway

1. Push to GitHub
2. Create a new **Web Service** on [Render](https://render.com)
3. Set:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r ../requirements.txt`
   - **Start Command**: `uvicorn app:app --host 0.0.0.0 --port $PORT`
4. Add environment variables from `.env.example`

### Frontend → Netlify / Vercel

1. Drag `frontend/` folder into Netlify dashboard, **or**
2. `vercel --cwd frontend`
3. Update `API_BASE` in `frontend/js/api.js` to point to your Render URL

---

## 🧠 API Reference

### `POST /api/predict`
```json
{
  "symbol": "TCS.NS",
  "days": 30,
  "period": "2y"
}
```
Returns historical prices + LSTM forecasted prices for charting.

### `POST /api/recommend`
```json
{
  "capital": 500000,
  "risk_tolerance": "Medium",
  "horizon": "mid",
  "manual_symbols": ["RELIANCE.NS", "TCS.NS"]
}
```
Returns recommended stocks with capital allocation, weights, Sharpe ratios.

### `GET /api/dashboard?symbols=TCS.NS,INFY.NS`
Returns live quotes, gainers, losers, sector breakdown, market sentiment.

### `GET /api/dashboard/history/{symbol}?period=6mo`
Returns OHLCV history for charting.

### `GET /api/dashboard/risk/{symbol}`
Returns Sharpe Ratio, Volatility, Max Drawdown, VaR, risk classification.

### `GET /api/stocks?sector=IT&search=tcs`
Returns catalogue of supported Indian stocks with filtering.

---

## 📊 Supported Indian Stocks (30+)

| Symbol | Name |
|--------|------|
| RELIANCE.NS | Reliance Industries |
| TCS.NS | Tata Consultancy Services |
| HDFCBANK.NS | HDFC Bank |
| INFY.NS | Infosys |
| ICICIBANK.NS | ICICI Bank |
| WIPRO.NS | Wipro |
| SBIN.NS | State Bank of India |
| BAJFINANCE.NS | Bajaj Finance |
| … | 22 more across IT, Banking, Pharma, Energy, FMCG |

---

## ⚙️ How LSTM Prediction Works

1. **Data**: 2 years of daily OHLCV fetched from Yahoo Finance
2. **Scaling**: MinMaxScaler normalises Close prices to `[0, 1]`
3. **Sequences**: 60-day sliding windows → (X, y) training sequences
4. **Architecture**: `LSTM(128) → Dropout(0.2) → LSTM(64) → Dropout(0.2) → Dense(32) → Dense(1)`
5. **Training**: Adam optimiser, MSE loss, EarlyStopping + ModelCheckpoint
6. **Inference**: Auto-regressive: each predicted point is fed back as next input
7. **Fallback**: If TensorFlow is unavailable, a statistical linear-trend model is used

---

## 🛡️ Risk Metrics

| Metric | Description |
|--------|-------------|
| Expected Return | Annualised mean daily return × 252 |
| Volatility | Annualised std deviation of daily returns |
| Sharpe Ratio | (Return − Risk-Free Rate) / Volatility |
| Max Drawdown | Largest peak-to-trough decline |
| VaR (95%) | Worst expected daily loss at 95% confidence |

Risk classification: `Low` (vol < 20%), `Medium` (20–35%), `High` (> 35%)

---

## 📝 Notes

- **Not financial advice.** This project is for educational / research purposes only.
- First prediction call may take 1–2 minutes as LSTM trains on-the-fly. Subsequent calls use the saved model.
- Yahoo Finance rate limits apply; data is cached for 1 hour to minimise API calls.

---

## 📄 License

MIT License — free to use, modify, and distribute.
