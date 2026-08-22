"""DASH-US-01: workspace metrics, always expressed in the preferred currency."""

import logging
from collections import defaultdict
from datetime import date as date_type, timedelta
from decimal import Decimal
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models
from app.repositories import get_workspace
from app.services.access import require_membership

logger = logging.getLogger(__name__)

EVENT = "DASHBOARD_AUDIT"

# Money in vs money out. Mirrors TransactionService.DIRECTION_BY_TYPE.
INFLOW_TYPES = ("INCOME", "REFUND", "DEBT")
OUTFLOW_TYPES = ("EXPENSE", "INVESTMENT", "LOAN")

# Sign a stored amount takes against a balance, keyed by the row's direction.
SIGN = {"credit": Decimal("1"), "debit": Decimal("-1")}

# How much history the trend series cover. Bounded on purpose: the series exist
# to be drawn, and an unbounded scan would grow with the workspace forever.
MONTHS_OF_HISTORY = 6
DAYS_OF_HISTORY = 30

ZERO = Decimal("0")


def _month_start(value: date_type) -> date_type:
    return value.replace(day=1)


def _add_month(value: date_type) -> date_type:
    """First day of the month after `value`'s month."""
    start = _month_start(value)
    if start.month == 12:
        return start.replace(year=start.year + 1, month=1)
    return start.replace(month=start.month + 1)


def _months_back(value: date_type, count: int) -> date_type:
    """First day of the month `count` months before `value`'s month."""
    start = _month_start(value)
    month_index = start.year * 12 + (start.month - 1) - count
    return date_type(month_index // 12, month_index % 12 + 1, 1)


class _Bucket:
    """Income, expense, and their net for one period, account, or day."""

    __slots__ = ("income", "expense")

    def __init__(self):
        self.income = ZERO
        self.expense = ZERO

    def add(self, type_: str, amount: Decimal) -> None:
        if type_ in INFLOW_TYPES:
            self.income += amount
        elif type_ in OUTFLOW_TYPES:
            self.expense += amount
        # TRANSFER is deliberately ignored: a transfer moves money between two
        # accounts in the same workspace, so counting it would inflate both
        # income and expense without changing the workspace's position.

    def as_dict(self) -> dict:
        return {
            "income": self.income,
            "expense": self.expense,
            "net": self.income - self.expense,
        }


class DashboardService:
    @staticmethod
    def get_summary(
        db: Session,
        workspace_id: int,
        user_id: int,
        today: date_type = None,
        ip_address: str = None
    ) -> dict:
        """
        Aggregates every recorded transaction into the workspace preferred currency.

        Each row is summed through `base_amount` — the amount already multiplied by
        the exchange rate snapshotted when it was recorded — so a rate that moved
        since then cannot restate a past month (BR-07a). Raw `amount` is never
        summed across currencies.

        Returns income, expense and net at four grains — all time, this month,
        today, and per account — plus daily and monthly series for trends. Three
        grouped queries cover all of it; nothing is computed per row in a loop.
        """
        ip_address = ip_address or "unknown"
        require_membership(db, workspace_id, user_id, EVENT, "event=DASHBOARD_VIEW", ip_address)

        workspace = get_workspace(db, workspace_id)
        today = today or date_type.today()
        month_start = _month_start(today)
        next_month = _add_month(today)

        recorded = (
            models.Transaction.workspace_id == workspace_id,
            models.Transaction.deleted_at.is_(None),
            models.Transaction.status == "recorded",
        )
        total = func.coalesce(func.sum(models.Transaction.base_amount), 0)

        # 1) All time, by type.
        all_time = _Bucket()
        for type_, amount in (
            db.query(models.Transaction.type, total)
            .filter(*recorded)
            .group_by(models.Transaction.type)
            .all()
        ):
            all_time.add(type_, Decimal(amount or 0))

        # 2) Per account, by type and direction. Direction gives the signed base
        #    movement — the only way to rebuild a balance that includes transfers,
        #    whose legs are both type TRANSFER with a positive amount.
        per_account = defaultdict(_Bucket)
        per_account_movement = defaultdict(lambda: ZERO)
        for account_id, type_, direction, amount in (
            db.query(
                models.Transaction.account_id,
                models.Transaction.type,
                models.Transaction.direction,
                total,
            )
            .filter(*recorded)
            .group_by(
                models.Transaction.account_id,
                models.Transaction.type,
                models.Transaction.direction,
            )
            .all()
        ):
            value = Decimal(amount or 0)
            per_account[account_id].add(type_, value)
            per_account_movement[account_id] += SIGN.get(direction, ZERO) * value

        # 3) One windowed query feeds both series and the month/today figures.
        window_start = min(_months_back(today, MONTHS_OF_HISTORY - 1), today - timedelta(days=DAYS_OF_HISTORY))
        per_day = defaultdict(_Bucket)
        for day, type_, amount in (
            db.query(models.Transaction.date, models.Transaction.type, total)
            .filter(*recorded, models.Transaction.date >= window_start)
            .group_by(models.Transaction.date, models.Transaction.type)
            .all()
        ):
            per_day[day].add(type_, Decimal(amount or 0))

        month = _Bucket()
        for day, bucket in per_day.items():
            if month_start <= day < next_month:
                month.income += bucket.income
                month.expense += bucket.expense

        # Archived accounts are included: their transactions are still counted in
        # every total, so dropping their opening balance would leave the workspace
        # total disagreeing with the sum of its own rows.
        accounts = (
            db.query(models.Account)
            .filter(models.Account.workspace_id == workspace_id)
            .order_by(models.Account.name)
            .all()
        )
        opening = sum(
            (Decimal(account.opening_base_balance or 0) for account in accounts),
            ZERO,
        )
        # Same construction as each account's base_balance, so the headline figure
        # is exactly the sum of the per-account rows.
        total_balance = opening + sum(per_account_movement.values(), ZERO)

        return {
            "currency": workspace.currency,
            "as_of": today.isoformat(),

            # Balance is a position, not a flow: opening balances plus every
            # recorded movement since.
            "total_balance": total_balance,

            "all_time": all_time.as_dict(),
            "month": {**month.as_dict(), "period": month_start.isoformat()},
            "today": {**per_day.get(today, _Bucket()).as_dict(), "period": today.isoformat()},

            "accounts": [
                {
                    "id": account.id,
                    "name": account.name,
                    "type": account.type,
                    "currency": account.currency,
                    "status": "archived" if account.deleted_at else "active",
                    # Balance in the account's own currency, and the same balance
                    # converted with the account's snapshot rate (BR-07a).
                    "balance": account.balance,
                    # Opening balance at its own snapshot rate plus every signed
                    # movement at the rate it was recorded at. Multiplying the
                    # current balance by the opening rate would be wrong the
                    # moment a rate moved, and would not sum to total_balance.
                    "base_balance": (
                        Decimal(account.opening_base_balance or 0)
                        + per_account_movement.get(account.id, ZERO)
                    ),
                    **per_account.get(account.id, _Bucket()).as_dict(),
                }
                for account in accounts
            ],

            "monthly_series": DashboardService._monthly_series(per_day, today),
            "daily_series": DashboardService._daily_series(per_day, today),
        }

    @staticmethod
    def _monthly_series(per_day: dict, today: date_type) -> list:
        """One entry per month, oldest first, with empty months kept as zeros."""
        totals = defaultdict(_Bucket)
        for day, bucket in per_day.items():
            key = _month_start(day)
            totals[key].income += bucket.income
            totals[key].expense += bucket.expense

        series = []
        for offset in range(MONTHS_OF_HISTORY - 1, -1, -1):
            key = _months_back(today, offset)
            series.append({"period": key.isoformat(), **totals.get(key, _Bucket()).as_dict()})
        return series

    @staticmethod
    def _daily_series(per_day: dict, today: date_type) -> list:
        """One entry per day for the trailing window, oldest first."""
        series = []
        for offset in range(DAYS_OF_HISTORY - 1, -1, -1):
            key = today - timedelta(days=offset)
            series.append({"period": key.isoformat(), **per_day.get(key, _Bucket()).as_dict()})
        return series
