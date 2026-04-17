"""
Simple in-memory + disk cache for stock data.
TTL-based caching to avoid hammering Yahoo Finance.
"""

import time
import json
import os
import hashlib
from typing import Any, Optional

CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", ".cache")
os.makedirs(CACHE_DIR, exist_ok=True)

# In-memory store  {key: (value, expiry_timestamp)}
_mem_cache: dict = {}


def _cache_key(prefix: str, *args) -> str:
    raw = prefix + "_" + "_".join(str(a) for a in args)
    return hashlib.md5(raw.encode()).hexdigest()


def get(prefix: str, *args, ttl: int = 300) -> Optional[Any]:
    """Retrieve from memory cache, then disk cache."""
    key = _cache_key(prefix, *args)

    # Memory hit
    if key in _mem_cache:
        value, expiry = _mem_cache[key]
        if time.time() < expiry:
            return value
        else:
            del _mem_cache[key]

    # Disk hit
    path = os.path.join(CACHE_DIR, key + ".json")
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                entry = json.load(f)
            if time.time() < entry["expiry"]:
                _mem_cache[key] = (entry["value"], entry["expiry"])
                return entry["value"]
            else:
                os.remove(path)
        except Exception:
            pass

    return None


def set(prefix: str, *args, value: Any, ttl: int = 300) -> None:
    """Store in memory and disk cache."""
    key = _cache_key(prefix, *args)
    expiry = time.time() + ttl

    _mem_cache[key] = (value, expiry)

    path = os.path.join(CACHE_DIR, key + ".json")
    try:
        with open(path, "w") as f:
            json.dump({"value": value, "expiry": expiry}, f)
    except Exception:
        pass


def invalidate(prefix: str, *args) -> None:
    key = _cache_key(prefix, *args)
    _mem_cache.pop(key, None)
    path = os.path.join(CACHE_DIR, key + ".json")
    if os.path.exists(path):
        os.remove(path)


def clear_all() -> None:
    _mem_cache.clear()
    for f in os.listdir(CACHE_DIR):
        if f.endswith(".json"):
            os.remove(os.path.join(CACHE_DIR, f))
