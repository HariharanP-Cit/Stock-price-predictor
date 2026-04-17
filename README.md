# Stock-price-predictor
# 📈 AI Investment Predictor & Stock Dashboard

## 🧠 Overview

The **AI Investment Predictor & Stock Dashboard** is a full-stack web application that leverages **deep learning (LSTM)** and real-time financial data to assist users in making informed investment decisions. The system predicts stock price trends, evaluates risk metrics, recommends optimal investment options, and provides an interactive dashboard for real-time tracking of stock performance.

This project integrates **machine learning, financial analytics, and web technologies** into a unified platform designed for both beginner and intermediate investors.

---

## 🚀 Key Features

### 🔹 1. Stock Price Prediction (LSTM Model)

* Uses **Long Short-Term Memory (LSTM)** neural networks to forecast future stock prices.
* Trained on historical stock data fetched via **Yahoo Finance API (yfinance)**.
* Supports customizable prediction horizons.

---

### 🔹 2. Investment Recommendation System

* Suggests optimal stocks based on:

  * User capital
  * Risk tolerance (Low / Medium / High)
  * Investment horizon
* Provides portfolio allocation strategies.

---

### 🔹 3. Risk Analysis

* Computes essential financial metrics:

  * Expected Returns
  * Volatility (Risk)
  * Sharpe Ratio
* Classifies stocks into risk categories.

---

### 🔹 4. Real-Time Stock Dashboard

* Interactive dashboard displaying:

  * 📊 Portfolio summary (investment, returns, profit/loss)
  * 📈 Historical and predicted price charts
  * 📉 Risk vs Return visualization
  * 📋 Live stock tracker (price, change %, volume)

---

### 🔹 5. Watchlist Management

* Add/remove stocks dynamically
* Track selected stocks in real time

---

### 🔹 6. Responsive UI

* Built using **Tailwind CSS**
* Fully responsive design (mobile + desktop)
* Clean and modern dashboard interface

---

## 🏗️ System Architecture

The application follows a **client-server architecture**:

```text
Frontend (HTML, Tailwind, JS)
        ↓
REST API (FastAPI / Flask)
        ↓
Data Layer (yfinance)
        ↓
ML Layer (LSTM Model)
        ↓
Analytics Layer (Risk + Recommendation)
        ↓
Response to Frontend (JSON)
```

---

## 🔄 Workflow

1. User inputs investment details (capital, risk level, horizon)
2. Frontend sends request to backend API
3. Backend:

   * Fetches historical stock data using yfinance
   * Preprocesses data (scaling + sequence generation)
   * Runs LSTM model for prediction
   * Calculates risk metrics
   * Generates stock recommendations
4. Backend returns results as JSON
5. Frontend renders:

   * Charts and predictions
   * Portfolio recommendations
   * Dashboard insights

---

## 🧰 Tech Stack

### 🔹 Frontend

* HTML5
* Tailwind CSS
* JavaScript
* Chart.js / Plotly

### 🔹 Backend

* FastAPI (or Flask)
* Python

### 🔹 Machine Learning

* TensorFlow / Keras (LSTM)
* Scikit-learn (data preprocessing)

### 🔹 Data Source

* Yahoo Finance API (yfinance)

---

## 📁 Project Structure

```text
investment-predictor/
│
├── backend/
│   ├── app.py
│   ├── routes/
│   ├── services/
│   ├── models/
│   └── utils/
│
├── frontend/
│   ├── index.html
│   ├── dashboard.html
│   ├── js/
│   └── styles/
│
├── model/
│   └── saved_model.h5
│
├── requirements.txt
├── Dockerfile
└── README.md
```

---

## 📊 Machine Learning Model Details

* Model Type: LSTM (Recurrent Neural Network)
* Input: Time-series stock price data
* Preprocessing:

  * MinMax Scaling
  * Sliding window (time steps = 60)
* Architecture:

  * 2 LSTM layers
  * Dropout layers
  * Dense output layer
* Output:

  * Future stock price predictions

---

## 📡 API Endpoints

### 🔹 Predict Stock Prices

```http
POST /predict
```

### 🔹 Recommend Stocks

```http
POST /recommend
```

### 🔹 Dashboard Data

```http
GET /dashboard
```

### 🔹 Available Stocks

```http
GET /stocks
```

---

## 🚀 Deployment

### 🔹 Backend

* Hosted on **Render / Railway**
* Runs using **Uvicorn**
* REST API enabled with CORS

### 🔹 Frontend

* Hosted on **Netlify / Vercel**
* Communicates with backend via API calls

---

## ⚙️ Installation & Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-username/investment-predictor.git
cd investment-predictor
```

### 2. Backend Setup

```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --reload
```

### 3. Frontend Setup

* Open `index.html` in browser
  or
* Deploy using Netlify/Vercel

---

## 📌 Future Enhancements

* 📊 Sentiment analysis using financial news
* 🤖 Advanced portfolio optimization (Markowitz model)
* 🔐 User authentication system
* 📄 Export investment reports (PDF)
* ☁️ Cloud-based model retraining pipeline

---

## 🎯 Use Cases

* Personal investment planning
* Educational tool for finance & ML
* Portfolio risk analysis
* Stock trend forecasting

---

## ⚠️ Disclaimer

This project is for **educational purposes only** and does not constitute financial advice. Stock market investments are subject to risk.

---

## 👨‍💻 Author

Developed by HARIHARAN P
