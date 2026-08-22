"""Supported currencies and snapshot exchange-rate rules (SRS BR-07, BR-07a)."""

from decimal import Decimal

# VND and USD are the only supported currencies (SRS §1.6, BR-07).
SUPPORTED_CURRENCIES = ("VND", "USD")

UNIT_RATE = Decimal("1")


def normalise_currency(currency: str) -> str:
    """
    Upper-cases the code and rejects anything outside the supported set.

    Raises ValueError('UNSUPPORTED_CURRENCY').
    """
    code = (currency or "").strip().upper()
    if code not in SUPPORTED_CURRENCIES:
        raise ValueError("UNSUPPORTED_CURRENCY")
    return code


# The rate that goes with an amount is fetched, not supplied — see
# app.services.exchange_rate_service.snapshot_rate.
