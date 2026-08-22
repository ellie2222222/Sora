# Prompt

You are a senior full-stack software architect with expertise in Python, FastAPI, PostgreSQL, and modern frontend development.

Design and implement a **production-ready Personal & Family Finance Management System**.

The project should follow clean architecture, be scalable, secure, and maintainable. Every component should be written as if it were going into production.

## Technology Stack

Backend

* Python 3.13
* FastAPI
* SQLAlchemy 2.0
* Alembic
* PostgreSQL
* Pydantic v2
* JWT Authentication
* Refresh Tokens
* Redis (token blacklist, caching, rate limiting)
* SMTP email service
* Docker
* Docker Compose

Frontend

* React
* Vite
* TypeScript
* TailwindCSS
* shadcn/ui
* React Query
* React Hook Form
* Zod
* Axios
* React Router

Infrastructure

* Docker Compose
* Environment variables
* Structured logging
* Swagger/OpenAPI

---

# Authentication

Implement complete authentication.

Features:

* Login
* Logout
* JWT Access Token
* Refresh Token
* Email Verification
* Token Revocation
* Session Management
* Rate limiting
* Brute-force protection

RBAC Roles

* Owner
* Family Admin
* Family Member
* Guest

---

# Family Workspace

A user can own multiple finance workspaces.

Examples

Personal

Family

Each workspace contains:

* members
* wallets
* accounts
* budgets
* categories
* transactions
* saving goals
* reports

Users can switch workspace.

---

# Family Invitation

Users can invite others through email.

Flow

Owner

↓

Invite Member

↓

Email sent

↓

Recipient clicks invitation

↓

Creates account (if needed)

↓

Automatically joins workspace

Invitation must include

* expiration
* secure token
* accept
* decline
* revoke

---

# Dashboard

Modern dashboard with charts.

Show

Current Balance

Monthly Income

Monthly Expense

Savings

Cash Flow

Budget Progress

Recent Transactions

Upcoming Bills

Expense Breakdown

Income Breakdown

Top Categories

Net Worth

Spending Trend

Monthly Comparison

Yearly Comparison

Family Member Spending

Savings Goal Progress

Charts

* Pie
* Bar
* Area
* Line
* Donut

---

# Transactions

Support

Income

Expense

Transfer

Refund

Investment

Loan

Debt

Fields

* title
* amount
* currency
* account
* wallet
* category
* subcategory
* tags
* notes
* receipt image
* attachment
* location
* transaction date
* recurring
* status

Support

* recurring transactions
* scheduled transactions
* duplicate detection
* bulk import CSV
* export CSV
* export Excel
* export PDF

---

# Categories

Default categories

Income

* Salary
* Bonus
* Interest
* Investment
* Gift
* Other

Expense

* Food
* Grocery
* Rent
* Mortgage
* Utilities
* Healthcare
* Entertainment
* Shopping
* Education
* Transportation
* Travel
* Insurance
* Pet
* Subscription
* Other

Allow custom categories.

---

# Wallets & Accounts

Support

Cash

Bank Account

Credit Card

Debit Card

Savings

Investment

Crypto

Digital Wallet

Each account contains

* current balance
* currency
* opening balance
* institution
* account number (masked)
* color
* icon

---

# Budget

Monthly

Weekly

Yearly

Custom

Track

* spent
* remaining
* percentage
* over budget

Notifications

* 50%
* 80%
* 100%
* exceeded

---

# Savings Goals

Examples

Emergency Fund

Vacation

Car

House

Wedding

Features

* target amount
* deadline
* progress
* monthly recommendation

---

# Bills

Recurring bills

Reminder

Status

* Paid
* Due
* Overdue

---

# Notifications

Email

In-app

Optional Push

Notify

Budget exceeded

Upcoming bills

Invitation accepted

Large expense

Monthly report

Yearly report

---

# Reports

Generate

Monthly Report

Yearly Report

Cash Flow

Income vs Expense

Category Analysis

Member Analysis

Budget Analysis

Net Worth

Export

PDF

Excel

CSV

---

# Search

Global search

Filters

Date

Amount

Category

Member

Wallet

Tag

Text

---

# Admin Features

Manage users

Manage family members

Permissions

Invitation history

Audit logs

Activity logs

Login history

Security logs

---

# Security

Use

* HTTPS-ready
* Password hashing (Argon2)
* JWT
* CSRF protection where applicable
* Secure Cookies (optional)
* SQL Injection prevention
* XSS prevention
* CORS
* Rate limiting
* Audit logging
* Validation on every endpoint

---

# Backend Architecture

Follow Clean Architecture

```
app/
    api/
    core/
    auth/
    users/
    families/
    workspaces/
    transactions/
    budgets/
    wallets/
    reports/
    notifications/
    emails/
    services/
    repositories/
    models/
    schemas/
    middleware/
    dependencies/
    tasks/
    utils/
```

Use

* Repository Pattern
* Service Layer
* Dependency Injection
* Generic CRUD
* Pagination
* Filtering
* Sorting
* Cursor Pagination

---

# Frontend Architecture

```
src/

app/

components/

features/

hooks/

services/

stores/

pages/

layouts/

types/

utils/

routes/
```

Use

* Feature-based architecture
* Lazy loading
* Protected routes
* Role-based routes
* Error boundaries
* Dark mode
* Responsive design
* Languages VI/EN

---

# API

RESTful APIs

Return

```json
{
    "success": true,
    "message": "...",
    "data": {},
    "meta": {}
}
```

Implement

* pagination
* filtering
* sorting
* validation
* consistent error responses

---

# Database

Design a normalized PostgreSQL schema including

* Users
* Family
* Workspace
* Invitations
* Members
* Accounts
* Wallets
* Categories
* Transactions
* Budgets
* BudgetItems
* SavingsGoals
* Bills
* Notifications
* Attachments
* AuditLogs
* RefreshTokens

Include

* foreign keys
* indexes
* constraints
* cascading rules

---

# Deliverables

Generate the project incrementally.

1. High-level architecture diagram.
2. Database ERD.
3. Folder structure.
4. PostgreSQL schema.
5. SQLAlchemy models.
6. Alembic migrations.
7. Authentication module.
8. Email service.
9. Invitation system.
10. Transaction module.
11. Budget module.
12. Dashboard APIs.
13. Frontend UI.
14. Docker setup.
15. Unit tests.
16. Integration tests.
17. API documentation.
18. Seed data.

Do not skip steps or generate placeholders. Build each module completely before proceeding to the next, ensuring all code is production-ready, type-safe, secure, well-documented, and thoroughly tested.
