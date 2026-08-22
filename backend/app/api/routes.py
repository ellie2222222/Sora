from fastapi import FastAPI, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Optional
import logging
from app.db import get_db
from app.core.config import settings
from app.schemas import (
    ApiResponse,
    RegisterRequest,
    RegisterResponse,
    LoginRequest,
    LoginResponse,
    TokenRefreshRequest,
    TokenRefreshResponse,
    VerifyEmailRequest,
    VerifyEmailResponse,
    LogoutRequest,
    ErrorResponse,
    CreateWorkspaceRequest,
    WorkspaceResponse,
    UpdateWorkspaceRequest,
    ChangePreferredCurrencyRequest,
    InviteMemberRequest,
    AcceptInvitationRequest,
    UpdateMemberRoleRequest,
    Currency,
    CategoryType,
    TransactionType,
    CreateCategoryRequest,
    UpdateCategoryRequest,
    CreateAccountRequest,
    UpdateAccountRequest,
    CreateTransactionRequest,
    CreateTransferRequest,
    UpdateTransactionRequest,
    CancelTransactionRequest
)
from app.services import (
    AuthService,
    WorkspaceService,
    AccountService,
    CategoryService,
    TransactionService,
    DashboardService
)
from app.services.exchange_rate_service import get_rate

logger = logging.getLogger(__name__)

# Domain error code -> HTTP status (API-03).
ERROR_STATUS = {
    # 404 Not Found
    "WORKSPACE_NOT_FOUND": 404,
    "MEMBER_NOT_FOUND": 404,
    "USER_NOT_FOUND": 404,
    "INVITATION_NOT_FOUND": 404,
    "ACCOUNT_NOT_FOUND": 404,
    "CATEGORY_NOT_FOUND": 404,
    "TRANSACTION_NOT_FOUND": 404,
    "BUDGET_NOT_FOUND": 404,
    "GOAL_NOT_FOUND": 404,
    "BILL_NOT_FOUND": 404,
    # 403 Forbidden
    "PERMISSION_DENIED": 403,
    "EMAIL_NOT_VERIFIED": 403,
    # 409 Conflict
    "USER_EMAIL_EXISTS": 409,
    "USER_ALREADY_MEMBER": 409,
    "WORKSPACE_NAME_EXISTS": 409,
    "ACCOUNT_NAME_EXISTS": 409,
    "ACCOUNT_ARCHIVED": 409,
    "ACCOUNT_HAS_PENDING_TRANSACTIONS": 409,
    "CATEGORY_NAME_EXISTS": 409,
    "CATEGORY_IN_USE": 409,
    "TRANSACTION_ALREADY_CANCELLED": 409,
    "BUDGET_PERIOD_CONFLICT": 409,
    "BUDGET_ALREADY_APPROVED": 409,
    "GOAL_NAME_EXISTS": 409,
    "GOAL_ARCHIVED": 409,
    "TOKEN_ALREADY_USED": 409,
    "INVITATION_ALREADY_USED": 409,
    # 410 Gone
    "TOKEN_EXPIRED": 410,
    "INVITATION_EXPIRED": 410,
    # 423 Locked
    "ACCOUNT_LOCKED": 423,
    # 503 Service Unavailable
    "EXCHANGE_RATE_UNAVAILABLE": 503,
    # 400 Bad Request (default) — INVALID_*, UNSUPPORTED_*
}


def envelope(message: str, data=None) -> dict:
    """Standard response envelope (API-02)."""
    return {
        "success": True,
        "message": message,
        "data": data,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


def domain_error(error: ValueError) -> HTTPException:
    """Maps a service-layer error code onto its HTTP status."""
    code = str(error)
    return HTTPException(status_code=ERROR_STATUS.get(code, 400), detail=code)


def get_client_ip(request: Request) -> str:
    """Extract client IP from request."""
    if request.client:
        return request.client.host
    return "unknown"


def get_current_user_id(request: Request, db: Session = Depends(get_db)):
    """Extract and verify user from Bearer token."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = auth_header[7:]  # Remove "Bearer "
    try:
        user = AuthService.get_current_user(db, token)
        return user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def setup_routes(app: FastAPI) -> None:
    """Register all API routes."""

    # Auth Endpoints

    @app.post("/api/v1/auth/register")
    async def register(
        request: RegisterRequest,
        http_request: Request,
        db: Session = Depends(get_db)
    ) -> dict:
        """AUTH-US-01: Register new user."""
        try:
            ip_address = get_client_ip(http_request)
            result = AuthService.register_user(
                db,
                request.email,
                request.password,
                request.full_name,
                ip_address
            )
            return {
                "success": True,
                "message": "User registered successfully. Please check your email to verify.",
                "data": {
                    "id": result["id"],
                    "email": result["email"],
                    "full_name": result["full_name"],
                    "email_verified": result["email_verified"],
                    "created_at": result["created_at"].isoformat()
                },
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        except ValueError as e:
            error_code = str(e)
            raise HTTPException(
                status_code=409 if error_code == "USER_EMAIL_EXISTS" else 400,
                detail=error_code
            )

    @app.post("/api/v1/auth/login")
    async def login(
        request: LoginRequest,
        http_request: Request,
        db: Session = Depends(get_db)
    ) -> dict:
        """AUTH-US-02: Login user."""
        try:
            ip_address = get_client_ip(http_request)
            result = AuthService.login_user(db, request.email, request.password, ip_address)
            return {
                "success": True,
                "message": "Login successful",
                "data": {
                    "access_token": result["access_token"],
                    "refresh_token": result["refresh_token"],
                    "token_type": result["token_type"],
                    "expires_in": result["expires_in"],
                    "user": result["user"]
                },
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        except ValueError as e:
            error_code = str(e)
            status_code = 423 if error_code == "ACCOUNT_LOCKED" else 401
            if error_code == "EMAIL_NOT_VERIFIED":
                status_code = 403
            elif error_code == "USER_NOT_FOUND":
                status_code = 404
            raise HTTPException(status_code=status_code, detail=error_code)

    @app.post("/api/v1/auth/email-verification")
    async def verify_email(
        request: VerifyEmailRequest,
        http_request: Request,
        db: Session = Depends(get_db)
    ) -> dict:
        """AUTH-US-01: Verify email address."""
        try:
            ip_address = get_client_ip(http_request)
            result = AuthService.verify_email(db, request.token, ip_address)
            return {
                "success": True,
                "message": result["message"],
                "data": {
                    "email": result["email"],
                    "verified_at": result["verified_at"].isoformat()
                },
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        except ValueError as e:
            error_code = str(e)
            status_code = 410 if error_code == "TOKEN_EXPIRED" else 400
            if error_code == "TOKEN_ALREADY_USED":
                status_code = 409
            raise HTTPException(status_code=status_code, detail=error_code)

    @app.post("/api/v1/auth/refresh")
    async def refresh_token(
        request: TokenRefreshRequest,
        http_request: Request,
        db: Session = Depends(get_db)
    ) -> dict:
        """AUTH-US-03: Refresh access token."""
        try:
            ip_address = get_client_ip(http_request)
            result = AuthService.refresh_access_token(db, request.refresh_token, ip_address)
            return {
                "success": True,
                "message": "Token refreshed successfully",
                "data": {
                    "access_token": result["access_token"],
                    "refresh_token": result["refresh_token"],
                    "token_type": result["token_type"],
                    "expires_in": result["expires_in"]
                },
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        except ValueError as e:
            raise HTTPException(status_code=401, detail=str(e))

    @app.post("/api/v1/auth/logout")
    async def logout(
        request: LogoutRequest,
        http_request: Request,
        user_id: int = Depends(get_current_user_id),
        db: Session = Depends(get_db)
    ) -> dict:
        """AUTH-US-04: Logout user."""
        try:
            ip_address = get_client_ip(http_request)
            result = AuthService.logout_user(db, request.refresh_token, user_id, ip_address)
            return {
                "success": True,
                "message": result["message"],
                "data": None,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    # Workspace Endpoints

    @app.post("/api/v1/workspaces")
    async def create_workspace(
        request: CreateWorkspaceRequest,
        http_request: Request,
        user_id: int = Depends(get_current_user_id),
        db: Session = Depends(get_db)
    ) -> dict:
        """WS-US-01: Create new workspace."""
        try:
            ip_address = get_client_ip(http_request)
            result = WorkspaceService.create_workspace(
                db, user_id, request.name, request.description, request.currency.value, ip_address
            )
            return {
                "success": True,
                "message": "Workspace created successfully",
                "data": result,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    @app.get("/api/v1/workspaces")
    async def list_workspaces(
        user_id: int = Depends(get_current_user_id),
        db: Session = Depends(get_db)
    ) -> dict:
        """WS-US-01: List user's workspaces."""
        try:
            result = WorkspaceService.list_user_workspaces(db, user_id)
            return {
                "success": True,
                "message": "Workspaces retrieved",
                "data": {"workspaces": result},
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    @app.get("/api/v1/workspaces/{workspace_id}")
    async def get_workspace(
        workspace_id: int,
        http_request: Request,
        user_id: int = Depends(get_current_user_id),
        db: Session = Depends(get_db)
    ) -> dict:
        """WS-US-01: Get workspace details."""
        try:
            ip_address = get_client_ip(http_request)
            result = WorkspaceService.get_workspace(db, workspace_id, user_id, ip_address)
            return {
                "success": True,
                "message": "Workspace retrieved",
                "data": result,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        except ValueError as e:
            status_code = 404 if str(e) == "WORKSPACE_NOT_FOUND" else 403
            raise HTTPException(status_code=status_code, detail=str(e))

    @app.put("/api/v1/workspaces/{workspace_id}")
    async def update_workspace(
        workspace_id: int,
        request: UpdateWorkspaceRequest,
        http_request: Request,
        user_id: int = Depends(get_current_user_id),
        db: Session = Depends(get_db)
    ) -> dict:
        """WS-US-01: Update workspace."""
        try:
            ip_address = get_client_ip(http_request)
            result = WorkspaceService.update_workspace(
                db, workspace_id, user_id, request.name, request.description, ip_address
            )
            return {
                "success": True,
                "message": "Workspace updated",
                "data": result,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        except ValueError as e:
            raise HTTPException(status_code=403, detail=str(e))

    @app.post("/api/v1/workspaces/{workspace_id}/preferred-currency")
    async def change_preferred_currency(
        workspace_id: int,
        request: ChangePreferredCurrencyRequest,
        http_request: Request,
        user_id: int = Depends(get_current_user_id),
        db: Session = Depends(get_db)
    ) -> dict:
        """
        Change the currency every summary is expressed in (OWNER only).

        Its own endpoint rather than a field on PUT /workspaces/{id}: it rewrites
        the snapshot rate on every account and transaction in the workspace, which
        is not something to do as a side effect of renaming (SDS §4.3).
        """
        try:
            result = WorkspaceService.change_preferred_currency(
                db, workspace_id, user_id, request.currency.value,
                ip_address=get_client_ip(http_request)
            )
            return envelope("Preferred currency changed", result)
        except ValueError as e:
            raise domain_error(e)

    @app.delete("/api/v1/workspaces/{workspace_id}")
    async def delete_workspace(
        workspace_id: int,
        http_request: Request,
        user_id: int = Depends(get_current_user_id),
        db: Session = Depends(get_db)
    ) -> dict:
        """WS-US-01: Delete workspace."""
        try:
            ip_address = get_client_ip(http_request)
            result = WorkspaceService.delete_workspace(db, workspace_id, user_id, ip_address)
            return {
                "success": True,
                "message": result["message"],
                "data": None,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        except ValueError as e:
            raise HTTPException(status_code=403, detail=str(e))

    @app.post("/api/v1/workspaces/{workspace_id}/members/invite")
    async def invite_member(
        workspace_id: int,
        request: InviteMemberRequest,
        http_request: Request,
        user_id: int = Depends(get_current_user_id),
        db: Session = Depends(get_db)
    ) -> dict:
        """WS-US-02: Send workspace invitation."""
        try:
            ip_address = get_client_ip(http_request)
            result = WorkspaceService.invite_member(
                db, workspace_id, request.email, request.role.value, user_id, ip_address
            )
            return {
                "success": True,
                "message": "Invitation sent",
                "data": result,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        except ValueError as e:
            status_code = 403 if str(e) == "PERMISSION_DENIED" else 400
            raise HTTPException(status_code=status_code, detail=str(e))

    @app.post("/api/v1/invitations/accept")
    async def accept_invitation(
        request: AcceptInvitationRequest,
        http_request: Request,
        user_id: int = Depends(get_current_user_id),
        db: Session = Depends(get_db)
    ) -> dict:
        """WS-US-02: Accept workspace invitation."""
        try:
            ip_address = get_client_ip(http_request)
            result = WorkspaceService.accept_invitation(db, request.token, user_id, ip_address)
            return {
                "success": True,
                "message": "Invitation accepted",
                "data": result,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        except ValueError as e:
            error_code = str(e)
            if error_code == "INVITATION_EXPIRED":
                status_code = 410
            elif error_code == "INVITATION_ALREADY_USED":
                status_code = 409
            else:
                status_code = 400
            raise HTTPException(status_code=status_code, detail=error_code)

    @app.put("/api/v1/workspaces/{workspace_id}/members/{member_user_id}/role")
    async def update_member_role(
        workspace_id: int,
        member_user_id: int,
        request: UpdateMemberRoleRequest,
        http_request: Request,
        user_id: int = Depends(get_current_user_id),
        db: Session = Depends(get_db)
    ) -> dict:
        """WS-US-03: Update member role."""
        try:
            ip_address = get_client_ip(http_request)
            result = WorkspaceService.update_member_role(
                db, workspace_id, member_user_id, request.role.value, user_id, ip_address
            )
            return {
                "success": True,
                "message": "Member role updated",
                "data": result,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        except ValueError as e:
            raise domain_error(e)

    @app.delete("/api/v1/workspaces/{workspace_id}/members/{member_user_id}")
    async def remove_member(
        workspace_id: int,
        member_user_id: int,
        http_request: Request,
        user_id: int = Depends(get_current_user_id),
        db: Session = Depends(get_db)
    ) -> dict:
        """WS-US-04: Remove workspace member."""
        try:
            ip_address = get_client_ip(http_request)
            result = WorkspaceService.remove_member(
                db, workspace_id, member_user_id, user_id, ip_address
            )
            return {
                "success": True,
                "message": result["message"],
                "data": None,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        except ValueError as e:
            raise domain_error(e)

    # ---------------------------------------------------------------- Dashboard

    @app.get("/api/v1/workspaces/{workspace_id}/dashboard")
    async def get_dashboard(
        workspace_id: int,
        http_request: Request,
        user_id: int = Depends(get_current_user_id),
        db: Session = Depends(get_db)
    ) -> dict:
        """DASH-US-01: metrics in the workspace preferred currency (BR-07a)."""
        try:
            result = DashboardService.get_summary(
                db, workspace_id, user_id, ip_address=get_client_ip(http_request)
            )
            return envelope("Dashboard retrieved", result)
        except ValueError as e:
            raise domain_error(e)

    # ------------------------------------------------------------ Exchange rates

    @app.get("/api/v1/exchange-rates")
    async def get_exchange_rate(
        base: Currency,
        quote: Currency,
        user_id: int = Depends(get_current_user_id)
    ) -> dict:
        """
        Read-only view of the rate the system would snapshot right now (BR-07a).

        Exists so a form can show what an amount converts to. It is never sent
        back on a write — the rate stored with a row is looked up server-side.
        """
        try:
            rate = get_rate(base.value, quote.value)
        except ValueError as e:
            raise domain_error(e)
        return envelope(
            "Exchange rate retrieved",
            {"base": base.value, "quote": quote.value, "rate": rate}
        )

    # ---------------------------------------------------------------- Categories

    @app.get("/api/v1/workspaces/{workspace_id}/categories")
    async def list_categories(
        workspace_id: int,
        http_request: Request,
        type: Optional[CategoryType] = None,
        include_archived: bool = False,
        user_id: int = Depends(get_current_user_id),
        db: Session = Depends(get_db)
    ) -> dict:
        """CAT-US-01: list workspace categories."""
        try:
            result = CategoryService.list_categories(
                db, workspace_id, user_id,
                type.value if type else None,
                include_archived,
                get_client_ip(http_request)
            )
            return envelope("Categories retrieved", {"categories": result})
        except ValueError as e:
            raise domain_error(e)

    @app.post("/api/v1/workspaces/{workspace_id}/categories", status_code=201)
    async def create_category_endpoint(
        workspace_id: int,
        request: CreateCategoryRequest,
        http_request: Request,
        user_id: int = Depends(get_current_user_id),
        db: Session = Depends(get_db)
    ) -> dict:
        """CAT-US-01: create a category (OWNER only)."""
        try:
            result = CategoryService.create_category(
                db, workspace_id, user_id,
                request.name, request.type.value, request.color, request.icon,
                get_client_ip(http_request)
            )
            return envelope("Category created", result)
        except ValueError as e:
            raise domain_error(e)

    @app.put("/api/v1/workspaces/{workspace_id}/categories/{category_id}")
    async def update_category_endpoint(
        workspace_id: int,
        category_id: int,
        request: UpdateCategoryRequest,
        http_request: Request,
        user_id: int = Depends(get_current_user_id),
        db: Session = Depends(get_db)
    ) -> dict:
        """CAT-US-01: update a category (OWNER only)."""
        try:
            result = CategoryService.update_category(
                db, workspace_id, category_id, user_id,
                request.name, request.color, request.icon,
                get_client_ip(http_request)
            )
            return envelope("Category updated", result)
        except ValueError as e:
            raise domain_error(e)

    @app.delete("/api/v1/workspaces/{workspace_id}/categories/{category_id}/archive")
    async def archive_category_endpoint(
        workspace_id: int,
        category_id: int,
        http_request: Request,
        user_id: int = Depends(get_current_user_id),
        db: Session = Depends(get_db)
    ) -> dict:
        """CAT-US-01: archive a category (OWNER only)."""
        try:
            result = CategoryService.archive_category(
                db, workspace_id, category_id, user_id, get_client_ip(http_request)
            )
            return envelope("Category archived", result)
        except ValueError as e:
            raise domain_error(e)

    # ------------------------------------------------------------------ Accounts

    @app.post("/api/v1/workspaces/{workspace_id}/accounts", status_code=201)
    async def create_account_endpoint(
        workspace_id: int,
        request: CreateAccountRequest,
        http_request: Request,
        user_id: int = Depends(get_current_user_id),
        db: Session = Depends(get_db)
    ) -> dict:
        """ACC-US-01: create a financial account."""
        try:
            result = AccountService.create_account(
                db, workspace_id, user_id,
                request.type.value, request.name, request.currency.value,
                request.opening_balance, request.institution, request.account_number,
                request.color, request.icon,
                ip_address=get_client_ip(http_request)
            )
            return envelope("Account created", result)
        except ValueError as e:
            raise domain_error(e)

    @app.get("/api/v1/workspaces/{workspace_id}/accounts")
    async def list_accounts(
        workspace_id: int,
        http_request: Request,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 25,
        user_id: int = Depends(get_current_user_id),
        db: Session = Depends(get_db)
    ) -> dict:
        """ACC-US-02: list accounts with balances."""
        try:
            result = AccountService.list_accounts(
                db, workspace_id, user_id, status, page, page_size,
                get_client_ip(http_request)
            )
            return envelope("Accounts retrieved", result)
        except ValueError as e:
            raise domain_error(e)

    @app.get("/api/v1/workspaces/{workspace_id}/accounts/{account_id}")
    async def get_account_endpoint(
        workspace_id: int,
        account_id: int,
        http_request: Request,
        user_id: int = Depends(get_current_user_id),
        db: Session = Depends(get_db)
    ) -> dict:
        """ACC-US-02: account details."""
        try:
            result = AccountService.get_account(
                db, workspace_id, account_id, user_id, get_client_ip(http_request)
            )
            return envelope("Account retrieved", result)
        except ValueError as e:
            raise domain_error(e)

    @app.put("/api/v1/workspaces/{workspace_id}/accounts/{account_id}")
    async def update_account_endpoint(
        workspace_id: int,
        account_id: int,
        request: UpdateAccountRequest,
        http_request: Request,
        user_id: int = Depends(get_current_user_id),
        db: Session = Depends(get_db)
    ) -> dict:
        """ACC-US-03: edit account (OWNER only; type, opening balance and currency immutable)."""
        try:
            result = AccountService.update_account(
                db, workspace_id, account_id, user_id,
                request.name, request.institution,
                request.account_number, request.color, request.icon,
                get_client_ip(http_request)
            )
            return envelope("Account updated", result)
        except ValueError as e:
            raise domain_error(e)

    @app.delete("/api/v1/workspaces/{workspace_id}/accounts/{account_id}/archive")
    async def archive_account_endpoint(
        workspace_id: int,
        account_id: int,
        http_request: Request,
        user_id: int = Depends(get_current_user_id),
        db: Session = Depends(get_db)
    ) -> dict:
        """ACC-US-04: archive account (OWNER only)."""
        try:
            result = AccountService.archive_account(
                db, workspace_id, account_id, user_id, get_client_ip(http_request)
            )
            return envelope("Account archived", result)
        except ValueError as e:
            raise domain_error(e)

    # -------------------------------------------------------------- Transactions

    @app.post("/api/v1/workspaces/{workspace_id}/transactions", status_code=201)
    async def create_transaction_endpoint(
        workspace_id: int,
        request: CreateTransactionRequest,
        http_request: Request,
        user_id: int = Depends(get_current_user_id),
        db: Session = Depends(get_db)
    ) -> dict:
        """TXN-US-01/02: record an income or expense transaction."""
        try:
            result = TransactionService.create_transaction(
                db, workspace_id, user_id,
                request.account_id, request.type.value, request.amount, request.date,
                request.category_id, request.description, request.notes, request.tags,
                request.receipt_url, request.location,
                ip_address=get_client_ip(http_request)
            )
            return envelope("Transaction recorded", result)
        except ValueError as e:
            raise domain_error(e)

    @app.post("/api/v1/workspaces/{workspace_id}/transactions/transfer", status_code=201)
    async def create_transfer_endpoint(
        workspace_id: int,
        request: CreateTransferRequest,
        http_request: Request,
        user_id: int = Depends(get_current_user_id),
        db: Session = Depends(get_db)
    ) -> dict:
        """TXN-US-03: transfer between two accounts in one atomic operation."""
        try:
            result = TransactionService.create_transfer(
                db, workspace_id, user_id,
                request.from_account_id, request.to_account_id, request.amount,
                request.date, request.description, request.notes,
                ip_address=get_client_ip(http_request)
            )
            return envelope("Transfer recorded", result)
        except ValueError as e:
            raise domain_error(e)

    @app.get("/api/v1/workspaces/{workspace_id}/transactions")
    async def list_transactions(
        workspace_id: int,
        http_request: Request,
        account_id: Optional[int] = None,
        category_id: Optional[int] = None,
        type: Optional[TransactionType] = None,
        status: Optional[str] = None,
        min_amount: Optional[Decimal] = None,
        max_amount: Optional[Decimal] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        search: Optional[str] = None,
        sort_by: str = "-date",
        page: int = 1,
        page_size: int = 25,
        user_id: int = Depends(get_current_user_id),
        db: Session = Depends(get_db)
    ) -> dict:
        """TXN-US-04: filtered, sorted, paginated transaction history."""
        try:
            result = TransactionService.list_transactions(
                db, workspace_id, user_id,
                account_id, category_id, type.value if type else None, status,
                min_amount, max_amount, start_date, end_date, search,
                sort_by, page, page_size,
                get_client_ip(http_request)
            )
            return envelope("Transactions retrieved", result)
        except ValueError as e:
            raise domain_error(e)

    @app.get("/api/v1/workspaces/{workspace_id}/transactions/{transaction_id}")
    async def get_transaction_endpoint(
        workspace_id: int,
        transaction_id: int,
        http_request: Request,
        user_id: int = Depends(get_current_user_id),
        db: Session = Depends(get_db)
    ) -> dict:
        """TXN-US-04: single transaction detail."""
        try:
            result = TransactionService.get_transaction(
                db, workspace_id, transaction_id, user_id, get_client_ip(http_request)
            )
            return envelope("Transaction retrieved", result)
        except ValueError as e:
            raise domain_error(e)

    @app.put("/api/v1/workspaces/{workspace_id}/transactions/{transaction_id}")
    async def update_transaction_endpoint(
        workspace_id: int,
        transaction_id: int,
        request: UpdateTransactionRequest,
        http_request: Request,
        user_id: int = Depends(get_current_user_id),
        db: Session = Depends(get_db)
    ) -> dict:
        """BR-03: metadata only — amount and account are immutable once recorded."""
        try:
            result = TransactionService.update_transaction(
                db, workspace_id, transaction_id, user_id,
                request.category_id, request.description, request.notes, request.tags,
                # An explicit `"category_id": null` in the body means "remove the
                # category"; the field being absent means "leave it alone".
                clear_category=(
                    "category_id" in request.model_fields_set and request.category_id is None
                ),
                ip_address=get_client_ip(http_request)
            )
            return envelope("Transaction updated", result)
        except ValueError as e:
            raise domain_error(e)

    @app.delete("/api/v1/workspaces/{workspace_id}/transactions/{transaction_id}")
    async def cancel_transaction_endpoint(
        workspace_id: int,
        transaction_id: int,
        http_request: Request,
        request: CancelTransactionRequest = None,
        user_id: int = Depends(get_current_user_id),
        db: Session = Depends(get_db)
    ) -> dict:
        """TXN-US-05: cancel a transaction and reverse its balance effect."""
        try:
            result = TransactionService.cancel_transaction(
                db, workspace_id, transaction_id, user_id,
                request.reason if request else None,
                get_client_ip(http_request)
            )
            return envelope("Transaction cancelled", result)
        except ValueError as e:
            raise domain_error(e)

    @app.get("/api/v1/health")
    async def health_check() -> dict:
        """Health check endpoint."""
        return {
            "status": "healthy",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        """Custom exception handler for HTTPException."""
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "message": exc.detail,
                "error_code": exc.detail,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )
