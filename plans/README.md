# Sora — Architecture & Implementation Plans

This directory contains the master architectural blueprints, domain designs, and feature implementation plans for the Sora personal and family finance management system.

Plans are organized into semantic, dedicated folders by domain.

---

## Directory Layout

```
plans/
├── README.md                                 # This index
├── architecture/                             # Core domain, schema, and financial engine plans
│   ├── domain-database-design.md             # Domain entities, ERD, schema rationale, constraints
│   ├── multi-currency-plan.md                # Multi-currency ledger architecture & converted totals
│   └── exchange-rate-resilience-plan.md      # FX caching, stale rate fallback, daily snapshots
└── mobile/                                   # Client application roadmap and offline capabilities
    └── offline-sync-plan.md                  # Offline-first data entry & background sync engine
```

---

## Plan Directory Index

### 1. Architecture & Core Domain (`plans/architecture/`)

| Document | Status | Summary |
|---|---|---|
| [`domain-database-design.md`](architecture/domain-database-design.md) | **Active Reference** | Defines the core domain model (User, Wallet, Account, Transaction, Category, Budget, Goal), ERD, PostgreSQL schema rationale, and business rules (BR-01 through BR-10). |
| [`multi-currency-plan.md`](architecture/multi-currency-plan.md) | **Implemented** | Master architecture establishing Sora as an exact native-currency ledger with optional base-currency converted totals. |
| [`exchange-rate-resilience-plan.md`](architecture/exchange-rate-resilience-plan.md) | **Implemented** | Design for handling FX rate unavailability, stale rate fallbacks, transparency indicators, and daily historical snapshot storage (`exchange_rate_snapshots`). |
| [`ai-chat-assistant-plan.md`](architecture/ai-chat-assistant-plan.md) | **Implemented** | AI assistant chat: pluggable model provider (deterministic stand-in by default), draft-and-confirm transactions, centre mobile tab. As-built differences in its §0. |

### 2. Mobile Client (`plans/mobile/`)

| Document | Status | Summary |
|---|---|---|
| [`offline-sync-plan.md`](mobile/offline-sync-plan.md) | **Draft** | Architecture specification for local-first optimistic mutations, mutation queue serialization via AsyncStorage, and background network reconciliation. |

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
