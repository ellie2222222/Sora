# Sora — Architecture & Implementation Plans

This directory contains the master architectural blueprints, domain designs, and feature implementation plans for the Sora personal and family finance management system.

Plans are organized into semantic, dedicated folders by domain.

---

## Directory Layout

```
plans/
├── README.md                                 # This index
├── architecture/                             # Core domain, schema, and financial engine plans
│   ├── domain-database-design.md             # Domain entities, ERD, schema rationale
│   ├── multi-currency-plan.md                # Multi-currency ledger architecture & converted totals
│   ├── exchange-rate-resilience-plan.md      # FX caching, stale rate fallback, daily snapshots
│   ├── timezone.md                           # Wallet calendar time: the brief
│   ├── wallet-timezone-plan.md               # Wallet calendar time: audit, decisions, phases
│   ├── ai-chat-assistant-plan.md             # AI assistant chat
│   ├── dashboard-current-state.md            # What the dashboard is today
│   └── dashboard-feature-roadmap.md          # Triaged dashboard ideas, not a commitment
├── mobile/                                   # Client application plans and decisions
│   ├── offline-sync-plan.md                  # Offline write queue & background sync engine
│   ├── e2e-framework-decision.md             # Maestro over Detox
│   └── transaction-ui-plan.md                # Transaction list UI refinement
└── tooling/                                  # Developer tooling
    └── seed-data-plan.md                     # Realistic demo/dev seed data through the API (scripts/seed/)
```
---

## Plan Directory Index

### 1. Architecture & Core Domain (`plans/architecture/`)

| Document | Status | Summary |
|---|---|---|
| [`domain-database-design.md`](architecture/domain-database-design.md) | **Active Reference** | Defines the core domain model (User, Wallet, Account, Transaction, Category, Budget, Goal), ERD and schema rationale; its §14 points at the migrations rather than copying them. |
| [`multi-currency-plan.md`](architecture/multi-currency-plan.md) | **Implemented (API)** | Master architecture establishing Sora as an exact native-currency ledger with optional base-currency converted totals. The converted total is served by `GET /dashboard?displayCurrency=`; the app does not show it yet (SDS §4.5). |
| [`exchange-rate-resilience-plan.md`](architecture/exchange-rate-resilience-plan.md) | **Implemented** | Design for handling FX rate unavailability, stale rate fallbacks, transparency indicators, and daily historical snapshot storage (`exchange_rate_snapshots`). |
| [`timezone.md`](architecture/timezone.md) | **Brief** | Requirements for wallet calendar time: an IANA `wallets.time_zone`, and every wallet day, month and "today" read in it. |
| [`wallet-timezone-plan.md`](architecture/wallet-timezone-plan.md) | **Implemented** | The audit of every instant-to-day site, the decisions taken against the brief, and the phase checklist. |
| [`ai-chat-assistant-plan.md`](architecture/ai-chat-assistant-plan.md) | **Implemented** | AI assistant chat: pluggable model provider (deterministic stand-in by default), draft-and-confirm transactions, centre mobile tab. As-built differences in its §0. |
| [`dashboard-current-state.md`](architecture/dashboard-current-state.md) | **Status snapshot** | What the dashboard computes today and what is known to be wrong with it. |
| [`dashboard-feature-roadmap.md`](architecture/dashboard-feature-roadmap.md) | **Triage** | Dashboard ideas triaged against the schema, contracts and SRS scope; Tier A phases 0–6 built (2026-09-22), the rest not a commitment. |

### 2. Mobile Client (`plans/mobile/`)

| Document | Status | Summary |
|---|---|---|
| [`offline-sync-plan.md`](mobile/offline-sync-plan.md) | **Implemented** | Optimistic offline writes for all five entities, a SQLite-backed write queue, and background sync with conflict retry/discard. Deviations from the draft are listed at its top. |
| [`e2e-framework-decision.md`](mobile/e2e-framework-decision.md) | **Accepted** | Maestro over Detox for the Android E2E suite (`mobile/e2e/`). |
| [`transaction-ui-plan.md`](mobile/transaction-ui-plan.md) | **Partly built** | Transaction list UI refinement, adapted to this codebase's theme tokens; its Status section lists what is already done. |


### 3. Tooling (`plans/tooling/`)

| Document | Status | Summary |
|---|---|---|
| [`seed-data-plan.md`](tooling/seed-data-plan.md) | **Implemented** | API-driven seed of a year of realistic data across four personas: every account, category, transaction, budget and goal kind, plus read-back verification. |

`modal-ui-form-plan.md`, a one-off review brief for tracing modal/form UI fields to their real
domain/schema representation, was removed once fully executed — its findings and fixes are recorded in
`verifications/2026-09-16-modal-form-consistency-review.md`, not kept as a live plan.

The mobile client's own tech stack, navigation, screens, and state management are documented in
[`SDS.md`](../SDS.md) (§3 UI Design, §4 System Architecture) and kept reconciled against the real
code — `mobile-development-plan.md`, an early full-app plan that had drifted from what was
actually built, was removed rather than kept in sync with a document that already covers the same
ground.

---

## Conventions & Standards

1. **File Naming**: All plans follow lowercase kebab-case (`kebab-case-plan.md`).
2. **Domain Grouping**: Placed into dedicated subfolders (`architecture/`, `mobile/`, etc.) rather than scattered at repository root or inside package directories.
3. **Immutability of Applied Migrations**: Domain plans describe the *intent and rationale* of schemas. Database migrations in [`db/migrations/`](../db/migrations/) remain the ultimate source of truth for runtime database structure.
