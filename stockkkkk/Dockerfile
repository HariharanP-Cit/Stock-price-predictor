# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM python:3.11-slim AS base

WORKDIR /app

# System deps (for numpy/pandas compilation)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY backend/ ./backend/
COPY model/   ./model/
COPY .env.example .env

# Working directory for the app
WORKDIR /app/backend

# ── Runtime ───────────────────────────────────────────────────────────────────
EXPOSE 8000

ENV PORT=8000
ENV PYTHONUNBUFFERED=1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
