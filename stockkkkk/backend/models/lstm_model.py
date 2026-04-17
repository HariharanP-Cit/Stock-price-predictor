"""
LSTM Model – build, train, save, and predict stock prices.
Uses TensorFlow/Keras with MinMaxScaler preprocessing.
"""

import os
import numpy as np
import pandas as pd
from typing import List, Tuple, Optional, Dict
from sklearn.preprocessing import MinMaxScaler

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"  # suppress TF noise

try:
    import tensorflow as tf
    from tensorflow.keras.models import Sequential, load_model
    from tensorflow.keras.layers import LSTM, Dense, Dropout
    from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    print("[lstm_model] TensorFlow not installed – using fallback predictor.")

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "model")
os.makedirs(MODEL_DIR, exist_ok=True)

WINDOW_SIZE = 60


# ── Model architecture ─────────────────────────────────────────────────────────

def build_lstm_model(window_size: int = WINDOW_SIZE) -> "tf.keras.Model":
    model = Sequential([
        LSTM(128, return_sequences=True, input_shape=(window_size, 1)),
        Dropout(0.2),
        LSTM(64, return_sequences=False),
        Dropout(0.2),
        Dense(32, activation="relu"),
        Dense(1),
    ])
    model.compile(optimizer="adam", loss="mean_squared_error")
    return model


# ── Data preparation ───────────────────────────────────────────────────────────

def prepare_sequences(
    prices: np.ndarray, window_size: int = WINDOW_SIZE
) -> Tuple[np.ndarray, np.ndarray]:
    """Split a 1-D price array into (X, y) training sequences."""
    X, y = [], []
    for i in range(window_size, len(prices)):
        X.append(prices[i - window_size : i, 0])
        y.append(prices[i, 0])
    return np.array(X).reshape(-1, window_size, 1), np.array(y)


# ── Train & save ───────────────────────────────────────────────────────────────

def train_and_save(
    symbol: str,
    df: pd.DataFrame,
    epochs: int = 30,
    batch_size: int = 32,
) -> Dict:
    """
    Train an LSTM on the Close prices of *df* and save the model.
    Returns a summary dict with train loss.
    """
    if not TF_AVAILABLE:
        return {"error": "TensorFlow not available"}

    prices = df["Close"].values.reshape(-1, 1)
    scaler = MinMaxScaler(feature_range=(0, 1))
    scaled = scaler.fit_transform(prices)

    train_size = int(len(scaled) * 0.85)
    train_data = scaled[:train_size]

    if len(train_data) <= WINDOW_SIZE:
        return {"error": "Not enough data to train"}

    X_train, y_train = prepare_sequences(train_data, WINDOW_SIZE)

    model = build_lstm_model(WINDOW_SIZE)

    model_path = os.path.join(MODEL_DIR, f"{symbol.replace('.', '_')}.keras")
    callbacks = [
        EarlyStopping(patience=5, restore_best_weights=True),
        ModelCheckpoint(model_path, save_best_only=True),
    ]

    history = model.fit(
        X_train, y_train,
        epochs=epochs,
        batch_size=batch_size,
        validation_split=0.1,
        callbacks=callbacks,
        verbose=0,
    )

    # Persist scaler params
    scaler_path = os.path.join(MODEL_DIR, f"{symbol.replace('.', '_')}_scaler.npy")
    np.save(scaler_path, np.array([scaler.data_min_[0], scaler.data_max_[0]]))

    return {
        "symbol": symbol,
        "epochs_run": len(history.history["loss"]),
        "final_loss": float(history.history["loss"][-1]),
        "model_path": model_path,
    }


# ── Load & predict ─────────────────────────────────────────────────────────────

def _load_scaler(symbol: str) -> Optional[MinMaxScaler]:
    scaler_path = os.path.join(MODEL_DIR, f"{symbol.replace('.', '_')}_scaler.npy")
    if not os.path.exists(scaler_path):
        return None
    arr = np.load(scaler_path)
    scaler = MinMaxScaler(feature_range=(0, 1))
    scaler.fit(arr.reshape(-1, 1))
    # reconstruct min/max
    scaler.data_min_ = np.array([arr[0]])
    scaler.data_max_ = np.array([arr[1]])
    scaler.data_range_ = np.array([arr[1] - arr[0]])
    scaler.scale_ = np.array([1.0 / (arr[1] - arr[0])])
    scaler.min_ = np.array([-arr[0] / (arr[1] - arr[0])])
    scaler.n_features_in_ = 1
    scaler.n_samples_seen_ = 1
    return scaler


def predict_future(
    symbol: str,
    df: pd.DataFrame,
    days: int = 30,
) -> Dict:
    """
    Predict the next *days* closing prices for *symbol*.
    Falls back to a statistical (AR) model if TF is unavailable.
    """
    prices = df["Close"].values.reshape(-1, 1)

    # ── Fallback statistical predictor ────────────────────────────────────────
    if not TF_AVAILABLE:
        return _statistical_predict(prices, df.index.tolist(), days)

    # ── Try saved LSTM model ───────────────────────────────────────────────────
    model_path = os.path.join(MODEL_DIR, f"{symbol.replace('.', '_')}.keras")
    if not os.path.exists(model_path):
        # Train on-the-fly (quick, 10 epochs)
        result = train_and_save(symbol, df, epochs=10)
        if "error" in result:
            return _statistical_predict(prices, df.index.tolist(), days)

    try:
        model = load_model(model_path)
        scaler = _load_scaler(symbol)
        if scaler is None:
            scaler = MinMaxScaler(feature_range=(0, 1))
            scaler.fit(prices)

        scaled = scaler.transform(prices)

        if len(scaled) < WINDOW_SIZE:
            return _statistical_predict(prices, df.index.tolist(), days)

        sequence = scaled[-WINDOW_SIZE:].reshape(1, WINDOW_SIZE, 1)
        predictions_scaled = []

        for _ in range(days):
            pred = model.predict(sequence, verbose=0)[0, 0]
            predictions_scaled.append(pred)
            sequence = np.append(sequence[:, 1:, :], [[[pred]]], axis=1)

        predictions = scaler.inverse_transform(
            np.array(predictions_scaled).reshape(-1, 1)
        ).flatten().tolist()

        return _format_prediction(prices, df.index.tolist(), predictions, days, "LSTM")

    except Exception as e:
        print(f"[lstm_model] Prediction error for {symbol}: {e}")
        return _statistical_predict(prices, df.index.tolist(), days)


# ── Statistical fallback ───────────────────────────────────────────────────────

def _statistical_predict(
    prices: np.ndarray,
    dates: list,
    days: int,
) -> Dict:
    """Simple linear trend + noise model as a lightweight fallback."""
    prices_flat = prices.flatten()
    n = len(prices_flat)
    x = np.arange(n)
    # Linear regression coefficients
    slope, intercept = np.polyfit(x, prices_flat, 1)
    last_price = prices_flat[-1]

    # Recent volatility
    period = -min(61, len(prices_flat))
    if len(prices_flat) > 1:
        returns = np.diff(prices_flat[period:]) / prices_flat[period:-1]
        vol = returns.std()
    else:
        vol = 0.01

    preds = []
    price = last_price
    for i in range(1, days + 1):
        trend = slope * 0.5
        noise = np.random.normal(0, vol * price * 0.3)
        price = price + trend + noise
        preds.append(round(float(price), 2))

    return _format_prediction(prices, dates, preds, days, "Statistical")


def _format_prediction(
    prices: np.ndarray,
    dates: list,
    predictions: List[float],
    days: int,
    method: str,
) -> Dict:
    import datetime

    last_date = dates[-1] if dates else "2024-01-01"
    try:
        # Handle pandas Timestamp, string, or datetime objects
        last_date_str = str(last_date)[:10]
        base = datetime.datetime.strptime(last_date_str, "%Y-%m-%d")
    except Exception:
        base = datetime.datetime.now()

    future_dates = []
    d = base
    count = 0
    while count < days:
        d += datetime.timedelta(days=1)
        if d.weekday() < 5:  # skip weekends
            future_dates.append(d.strftime("%Y-%m-%d"))
            count += 1

    last_actual = float(prices[-1][0])
    pred_final  = predictions[-1]
    pct_change  = ((pred_final - last_actual) / last_actual) * 100

    return {
        "method": method,
        "last_actual_price": round(last_actual, 2),
        "predicted_prices": [round(p, 2) for p in predictions],
        "prediction_dates": future_dates,
        "days": days,
        "predicted_final_price": round(pred_final, 2),
        "expected_pct_change": round(pct_change, 2),
        "direction": "UP" if pct_change > 0 else "DOWN",
    }
