"""TXN-US-01 … TXN-US-05: recording, listing, and cancelling transactions."""

import logging
import uuid
from datetime import date as date_type
from decimal import Decimal
from sqlalchemy.orm import Session

from app.repositories import (
    adjust_account_balance,
    cancel_transaction,
    create_audit_log,
    create_transaction,
    get_account,
    get_category,
    get_transaction,
    get_workspace,
    get_workspace_member,
    list_transfer_group,
    list_workspace_transactions,
    update_transaction_metadata,
)
from app.services.access import require_membership
from app.services.exchange_rate_service import snapshot_rate

logger = logging.getLogger(__name__)

EVENT = "TXN_AUDIT"

# Which way each transaction type moves an account's balance. The SRS names the
# types (§1.4) but does not state their direction, so it is fixed here:
#   INCOME/REFUND/DEBT      → credit; funds arrive (a DEBT is money borrowed in)
#   EXPENSE/INVESTMENT/LOAN → debit; funds leave (a LOAN is money lent out)
# TRANSFER never uses this map — its two legs carry an explicit direction each.
DIRECTION_BY_TYPE = {
    "INCOME": "credit",
    "REFUND": "credit",
    "DEBT": "credit",
    "EXPENSE": "debit",
    "INVESTMENT": "debit",
    "LOAN": "debit",
}

# Sign a stored amount takes when applied to a balance. Amounts are always
# positive on the row; direction alone decides the sign.
SIGN = {"credit": Decimal("1"), "debit": Decimal("-1")}

MAX_PAGE_SIZE = 1000


def _to_dict(transaction, account_name: str = None, category_name: str = None) -> dict:
    return {
        "id": transaction.id,
        "workspace_id": transaction.workspace_id,
        "account_id": transaction.account_id,
        "account_name": account_name,
        "category_id": transaction.category_id,
        "category_name": category_name,
        "type": transaction.type,
        "amount": transaction.amount,
        "direction": transaction.direction,
        "currency": transaction.currency,
        "exchange_rate": transaction.exchange_rate,
        "base_amount": transaction.base_amount,
        "date": transaction.date,
        "description": transaction.description,
        "notes": transaction.notes,
        "tags": transaction.tags,
        "status": transaction.status,
        "created_by": transaction.created_by,
        "created_at": transaction.created_at,
    }


def _fail(db, action, error_code, ip_address, user_id, entity_ids=None):
    create_audit_log(
        db,
        event_name=EVENT,
        action=action,
        result="failure",
        error_code=error_code,
        ip_address=ip_address,
        user_id=user_id,
        entity_type="Transaction",
        entity_ids=entity_ids
    )
    raise ValueError(error_code)


class TransactionService:
    @staticmethod
    def create_transaction(
        db: Session,
        workspace_id: int,
        user_id: int,
        account_id: int,
        type: str,
        amount: Decimal,
        date: date_type,
        category_id: int = None,
        description: str = None,
        notes: str = None,
        tags: str = None,
        receipt_url: str = None,
        location: str = None,
        ip_address: str = None
    ) -> dict:
        """
        TXN-US-01/02: records a transaction and applies its balance effect in one
        atomic unit. Transfers go through create_transfer instead.

        The rate to the workspace preferred currency is fetched and snapshotted on
        the row, so later rate movements never restate what is already recorded
        (BR-07). The caller does not choose the rate.
        """
        ip_address = ip_address or "unknown"
        action = "event=TXN_CREATE"
        require_membership(db, workspace_id, user_id, EVENT, action, ip_address)

        scope = f"workspace_id={workspace_id}"

        if type == "TRANSFER":
            _fail(db, action, "INVALID_TRANSFER", ip_address, user_id, scope)

        if amount is None or amount <= 0:
            _fail(db, action, "INVALID_AMOUNT", ip_address, user_id, scope)

        account = get_account(db, account_id)
        if not account or account.workspace_id != workspace_id:
            _fail(db, action, "ACCOUNT_NOT_FOUND", ip_address, user_id, scope)
        if account.deleted_at is not None:
            _fail(db, action, "ACCOUNT_ARCHIVED", ip_address, user_id, f"account_id={account_id} {scope}")

        category = None
        if category_id is not None:
            category = get_category(db, category_id)
            if not category or category.workspace_id != workspace_id:
                _fail(db, action, "CATEGORY_NOT_FOUND", ip_address, user_id, scope)

        workspace = get_workspace(db, workspace_id)
        try:
            # BR-07: the account's currency governs its transactions, so the rate
            # is looked up for that currency.
            rate = snapshot_rate(workspace.currency, account.currency)
        except ValueError as error:
            _fail(db, action, str(error), ip_address, user_id, f"account_id={account_id} {scope}")

        try:
            transaction = create_transaction(
                db,
                workspace_id=workspace_id,
                account_id=account_id,
                type=type,
                amount=amount,
                # BR-07: the account's currency governs its transactions.
                currency=account.currency,
                direction=DIRECTION_BY_TYPE[type],
                exchange_rate=rate,
                date=date,
                created_by=user_id,
                category_id=category_id,
                description=description,
                notes=notes,
                tags=tags,
                receipt_url=receipt_url,
                location=location,
                commit=False
            )
            adjust_account_balance(db, account_id, SIGN[DIRECTION_BY_TYPE[type]] * amount)
            db.commit()
            db.refresh(transaction)
        except Exception:
            db.rollback()
            raise

        logger.info(
            f"[TXN] Recorded {type} id={transaction.id} amount={amount} account={account_id}"
        )
        create_audit_log(
            db,
            event_name=EVENT,
            action=action,
            result="success",
            ip_address=ip_address,
            user_id=user_id,
            entity_type="Transaction",
            entity_ids=f"transaction_id={transaction.id} account_id={account_id} {scope}"
        )
        return _to_dict(transaction, account.name, category.name if category else None)

    @staticmethod
    def create_transfer(
        db: Session,
        workspace_id: int,
        user_id: int,
        from_account_id: int,
        to_account_id: int,
        amount: Decimal,
        date: date_type,
        description: str = None,
        notes: str = None,
        ip_address: str = None
    ) -> dict:
        """
        TXN-US-03: debits the source and credits the destination as one atomic
        operation, linked by a shared transfer group. Cross-currency transfers
        credit the destination in the destination account's currency.
        """
        ip_address = ip_address or "unknown"
        action = "event=TXN_TRANSFER"
        require_membership(db, workspace_id, user_id, EVENT, action, ip_address)

        scope = f"workspace_id={workspace_id}"

        if from_account_id == to_account_id:
            _fail(db, action, "INVALID_TRANSFER", ip_address, user_id, scope)
        if amount is None or amount <= 0:
            _fail(db, action, "INVALID_AMOUNT", ip_address, user_id, scope)

        source = get_account(db, from_account_id)
        destination = get_account(db, to_account_id)

        for account in (source, destination):
            if not account or account.workspace_id != workspace_id:
                _fail(db, action, "ACCOUNT_NOT_FOUND", ip_address, user_id, scope)
            if account.deleted_at is not None:
                _fail(db, action, "ACCOUNT_ARCHIVED", ip_address, user_id, scope)

        workspace = get_workspace(db, workspace_id)
        try:
            # Each leg carries its own snapshot: the two accounts may hold
            # different currencies, and each is converted on its own terms.
            debit_rate = snapshot_rate(workspace.currency, source.currency)
            credit_rate = snapshot_rate(workspace.currency, destination.currency)
        except ValueError as error:
            _fail(db, action, str(error), ip_address, user_id, scope)

        group_id = str(uuid.uuid4())

        # The credit is stated in the destination account's currency, so a
        # cross-currency transfer converts through the preferred currency:
        # amount × debit_rate is the value that left, and dividing by the
        # destination's rate expresses that same value in its currency. Crediting
        # the raw number instead would turn 100 USD into 100 VND.
        credited = (amount * debit_rate / credit_rate).quantize(Decimal("0.01"))

        try:
            debit = create_transaction(
                db,
                workspace_id=workspace_id,
                account_id=from_account_id,
                type="TRANSFER",
                amount=amount,
                direction="debit",
                currency=source.currency,
                exchange_rate=debit_rate,
                date=date,
                created_by=user_id,
                description=description or f"Transfer to {destination.name}",
                notes=notes,
                transfer_group_id=group_id,
                commit=False
            )
            credit = create_transaction(
                db,
                workspace_id=workspace_id,
                account_id=to_account_id,
                type="TRANSFER",
                amount=credited,
                direction="credit",
                currency=destination.currency,
                exchange_rate=credit_rate,
                date=date,
                created_by=user_id,
                description=description or f"Transfer from {source.name}",
                notes=notes,
                transfer_group_id=group_id,
                commit=False
            )
            adjust_account_balance(db, from_account_id, -amount)
            adjust_account_balance(db, to_account_id, credited)
            db.commit()
            db.refresh(debit)
            db.refresh(credit)
        except Exception:
            db.rollback()
            raise

        logger.info(
            f"[TXN] Transfer group={group_id} amount={amount} "
            f"from={from_account_id} to={to_account_id}"
        )
        create_audit_log(
            db,
            event_name=EVENT,
            action=action,
            result="success",
            ip_address=ip_address,
            user_id=user_id,
            entity_type="Transaction",
            entity_ids=(
                f"transaction_id={debit.id} transaction_id={credit.id} "
                f"account_id={from_account_id} account_id={to_account_id} {scope}"
            )
        )
        return {
            "transfer_group_id": group_id,
            "debit": _to_dict(debit, source.name),
            "credit": _to_dict(credit, destination.name),
        }

    @staticmethod
    def list_transactions(
        db: Session,
        workspace_id: int,
        user_id: int,
        account_id: int = None,
        category_id: int = None,
        type: str = None,
        status: str = None,
        min_amount: Decimal = None,
        max_amount: Decimal = None,
        start_date: date_type = None,
        end_date: date_type = None,
        search: str = None,
        sort_by: str = "-date",
        page: int = 1,
        page_size: int = 25,
        ip_address: str = None
    ) -> dict:
        """TXN-US-04: filtered, sorted, paginated history (API-05, API-06)."""
        ip_address = ip_address or "unknown"
        action = "event=TXN_LIST"
        require_membership(db, workspace_id, user_id, EVENT, action, ip_address)

        if start_date and end_date and start_date > end_date:
            _fail(db, action, "INVALID_DATE_RANGE", ip_address, user_id, f"workspace_id={workspace_id}")

        page = max(1, page)
        page_size = min(max(1, page_size), MAX_PAGE_SIZE)

        transactions, total = list_workspace_transactions(
            db,
            workspace_id,
            account_id=account_id,
            category_id=category_id,
            type=type,
            status=status,
            min_amount=min_amount,
            max_amount=max_amount,
            start_date=start_date,
            end_date=end_date,
            search=search,
            sort_by=sort_by,
            page=page,
            page_size=page_size
        )

        # Resolve display names in one pass to avoid an N+1 per row (PF-01).
        account_names = {}
        category_names = {}
        for transaction in transactions:
            if transaction.account_id not in account_names:
                account = get_account(db, transaction.account_id)
                account_names[transaction.account_id] = account.name if account else None
            if transaction.category_id and transaction.category_id not in category_names:
                category = get_category(db, transaction.category_id)
                category_names[transaction.category_id] = category.name if category else None

        return {
            "transactions": [
                _to_dict(
                    t,
                    account_names.get(t.account_id),
                    category_names.get(t.category_id) if t.category_id else None
                )
                for t in transactions
            ],
            "total": total,
            "page": page,
            "page_size": page_size,
            "has_more": page * page_size < total,
        }

    @staticmethod
    def get_transaction(
        db: Session,
        workspace_id: int,
        transaction_id: int,
        user_id: int,
        ip_address: str = None
    ) -> dict:
        ip_address = ip_address or "unknown"
        action = "event=TXN_GET"
        require_membership(db, workspace_id, user_id, EVENT, action, ip_address)

        transaction = get_transaction(db, transaction_id)
        if not transaction or transaction.workspace_id != workspace_id:
            _fail(db, action, "TRANSACTION_NOT_FOUND", ip_address, user_id, f"transaction_id={transaction_id}")

        account = get_account(db, transaction.account_id)
        category = get_category(db, transaction.category_id) if transaction.category_id else None
        return _to_dict(
            transaction,
            account.name if account else None,
            category.name if category else None
        )

    @staticmethod
    def update_transaction(
        db: Session,
        workspace_id: int,
        transaction_id: int,
        user_id: int,
        category_id: int = None,
        description: str = None,
        notes: str = None,
        tags: str = None,
        clear_category: bool = False,
        ip_address: str = None
    ) -> dict:
        """
        BR-03: a recorded transaction's account and amount are immutable, so only
        classification and notes can change. Correcting an amount means cancelling
        and recording a replacement.

        `clear_category` distinguishes "no new category supplied" from "remove the
        category", which a bare None cannot express.
        """
        ip_address = ip_address or "unknown"
        action = "event=TXN_UPDATE"
        require_membership(db, workspace_id, user_id, EVENT, action, ip_address)

        transaction = get_transaction(db, transaction_id)
        if not transaction or transaction.workspace_id != workspace_id:
            _fail(db, action, "TRANSACTION_NOT_FOUND", ip_address, user_id, f"transaction_id={transaction_id}")

        if transaction.is_cancelled():
            _fail(db, action, "TRANSACTION_ALREADY_CANCELLED", ip_address, user_id, f"transaction_id={transaction_id}")

        if category_id is not None:
            category = get_category(db, category_id)
            if not category or category.workspace_id != workspace_id:
                _fail(db, action, "CATEGORY_NOT_FOUND", ip_address, user_id, f"transaction_id={transaction_id}")

        updated = update_transaction_metadata(
            db, transaction_id, category_id, description, notes, tags,
            clear_category=clear_category
        )

        create_audit_log(
            db,
            event_name=EVENT,
            action=action,
            result="success",
            ip_address=ip_address,
            user_id=user_id,
            entity_type="Transaction",
            entity_ids=f"transaction_id={transaction_id} workspace_id={workspace_id}"
        )
        account = get_account(db, updated.account_id)
        return _to_dict(updated, account.name if account else None)

    @staticmethod
    def cancel_transaction(
        db: Session,
        workspace_id: int,
        transaction_id: int,
        user_id: int,
        reason: str = None,
        ip_address: str = None
    ) -> dict:
        """
        TXN-US-05: only the creator or an OWNER may cancel. The balance effect is
        reversed immediately, and both halves of a transfer are cancelled together.
        """
        ip_address = ip_address or "unknown"
        action = "event=TXN_CANCEL"
        member = require_membership(db, workspace_id, user_id, EVENT, action, ip_address)

        transaction = get_transaction(db, transaction_id)
        if not transaction or transaction.workspace_id != workspace_id:
            _fail(db, action, "TRANSACTION_NOT_FOUND", ip_address, user_id, f"transaction_id={transaction_id}")

        if transaction.is_cancelled():
            _fail(db, action, "TRANSACTION_ALREADY_CANCELLED", ip_address, user_id, f"transaction_id={transaction_id}")

        if transaction.created_by != user_id and member.role != "OWNER":
            _fail(db, action, "PERMISSION_DENIED", ip_address, user_id, f"transaction_id={transaction_id}")

        # A transfer is one business event; cancelling either half cancels both.
        if transaction.transfer_group_id:
            affected = [
                t for t in list_transfer_group(db, transaction.transfer_group_id)
                if t.status == "recorded"
            ]
        else:
            affected = [transaction]

        try:
            for item in affected:
                # Reversal is the stored direction with the sign flipped, which
                # works identically for a transfer leg and a plain transaction —
                # no inference from insertion order.
                delta = -SIGN[item.direction] * item.amount
                adjust_account_balance(db, item.account_id, delta)
                cancel_transaction(db, item.id, reason)
            db.commit()
        except Exception:
            db.rollback()
            raise

        logger.info(f"[TXN] Cancelled transaction id={transaction_id} ({len(affected)} row(s))")
        create_audit_log(
            db,
            event_name=EVENT,
            action=action,
            result="success",
            ip_address=ip_address,
            user_id=user_id,
            entity_type="Transaction",
            entity_ids=f"transaction_id={transaction_id} workspace_id={workspace_id}",
            details=f"note={reason}" if reason else None
        )

        refreshed = get_transaction(db, transaction_id)
        account = get_account(db, refreshed.account_id)
        return _to_dict(refreshed, account.name if account else None)
