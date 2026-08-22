"""
Snapshot exchange-rate lookup (SRS FR-13b, BR-07a).

A rate is never entered by a user. When money is recorded in a currency other
than the workspace preferred currency, the system fetches the live rate, stores
it on the row, and uses it only for calculation — later rate movements never
restate what is already recorded (BR-07).

Rates are cached in-process: providers publish roughly once a day, so a short
TTL would only add latency and failure surface. On a provider outage a stale
cached rate is preferred over refusing the write; a configured fallback is the
last resort before the caller is told the rate is unavailable.

Only VND and USD exist, so one fetch fills both directions.
"""

import logging
import threading
from datetime import datetime, timedelta, timezone
from decimal import Decimal, DivisionByZero, InvalidOperation

import httpx

from app.core.config import settings
from app.services.currency import UNIT_RATE, SUPPORTED_CURRENCIES

logger = logging.getLogger(__name__)

# A fetched rate is served without asking the provider again for this long.
_TTL = timedelta(minutes=settings.EXCHANGE_RATE_CACHE_TTL_MINUTES)

# How far past the TTL a cached rate may still be used when the provider is
# unreachable. Beyond this a month-old rate is too wrong to book money at.
_STALE_LIMIT = timedelta(days=30)

# (base, quote) -> (rate, fetched_at). Guarded by _lock: FastAPI runs sync
# endpoints on a threadpool, so several requests can land here at once.
_cache: dict[tuple[str, str], tuple[Decimal, datetime]] = {}
_lock = threading.Lock()


def clear_cache() -> None:
    """Drop every cached rate. Used by tests and after a config change."""
    with _lock:
        _cache.clear()


def snapshot_rate(workspace_currency: str, currency: str) -> Decimal:
    """
    Rate converting `currency` into the workspace preferred currency.

    Exactly 1 when the two match — no lookup, no network call.

    Raises ValueError('EXCHANGE_RATE_UNAVAILABLE').
    """
    if currency == workspace_currency:
        return UNIT_RATE
    return get_rate(currency, workspace_currency)


def get_rate(base: str, quote: str) -> Decimal:
    """
    Live rate for 1 unit of `base` expressed in `quote`.

    Raises ValueError('EXCHANGE_RATE_UNAVAILABLE') when no usable rate exists.
    """
    if base == quote:
        return UNIT_RATE

    cached = _cached(base, quote)
    if cached is not None:
        rate, fetched_at = cached
        if _now() - fetched_at < _TTL:
            return rate

    try:
        return _fetch(base, quote)
    except Exception as error:  # network, HTTP, or payload — all recoverable
        logger.warning(
            f"[FX] Provider lookup failed for {base}->{quote}: {type(error).__name__}: {error}"
        )

    if cached is not None:
        rate, fetched_at = cached
        age = _now() - fetched_at
        if age < _STALE_LIMIT:
            logger.warning(
                f"[FX] Using stale rate {base}->{quote}={rate} (age {age.days}d)"
            )
            return rate

    fallback = _fallback(base, quote)
    if fallback is not None:
        logger.warning(f"[FX] Using configured fallback rate {base}->{quote}={fallback}")
        return fallback

    raise ValueError("EXCHANGE_RATE_UNAVAILABLE")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _cached(base: str, quote: str):
    with _lock:
        return _cache.get((base, quote))


def _store(base: str, quote: str, rate: Decimal) -> None:
    """Cache the pair and its reciprocal — one fetch answers both directions."""
    now = _now()
    with _lock:
        _cache[(base, quote)] = (rate, now)
        try:
            _cache[(quote, base)] = (UNIT_RATE / rate, now)
        except (DivisionByZero, InvalidOperation):
            pass


def _fetch(base: str, quote: str) -> Decimal:
    """
    Ask the provider for `base`, cache every supported quote it returns.

    The default provider (open.er-api.com) needs no API key and answers
    `GET /v6/latest/{base}` with `{"result": "success", "rates": {...}}`.
    """
    url = f"{settings.EXCHANGE_RATE_API_URL.rstrip('/')}/{base}"
    response = httpx.get(url, timeout=settings.EXCHANGE_RATE_TIMEOUT_SECONDS)
    response.raise_for_status()
    payload = response.json()

    rates = payload.get("rates") or payload.get("conversion_rates") or {}
    if not isinstance(rates, dict):
        raise ValueError(f"unexpected payload shape from {url}")

    fetched = None
    for code in SUPPORTED_CURRENCIES:
        if code == base or code not in rates:
            continue
        rate = _to_positive_decimal(rates[code])
        if rate is None:
            continue
        _store(base, code, rate)
        if code == quote:
            fetched = rate

    if fetched is None:
        raise ValueError(f"no usable {base}->{quote} rate in provider payload")

    logger.info(f"[FX] Fetched rate {base}->{quote}={fetched}")
    return fetched


def _to_positive_decimal(value) -> Decimal:
    try:
        rate = Decimal(str(value))
    except (InvalidOperation, TypeError):
        return None
    return rate if rate > 0 else None


def _fallback(base: str, quote: str) -> Decimal:
    """
    Static last-resort rate from configuration.

    One setting covers both directions because only USD and VND are supported:
    EXCHANGE_RATE_FALLBACK_USD_VND is USD expressed in VND, and the VND->USD
    rate is its reciprocal. Unset (0) means the write fails rather than booking
    money at a made-up rate.
    """
    configured = _to_positive_decimal(settings.EXCHANGE_RATE_FALLBACK_USD_VND)
    if configured is None:
        return None
    if (base, quote) == ("USD", "VND"):
        return configured
    if (base, quote) == ("VND", "USD"):
        return UNIT_RATE / configured
    return None
