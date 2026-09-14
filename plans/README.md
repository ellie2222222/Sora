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
    ├── mobile-development-plan.md            # React Native full plan, screen inventory, delivery checklist
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

### 2. Mobile Client (`plans/mobile/`)

| Document | Status | Summary |
|---|---|---|
| [`mobile-development-plan.md`](mobile/mobile-development-plan.md) | **In Progress / Living** | Master blueprint for the React Native mobile client. Outlines tech stack, navigation hierarchy, screen state management, and delivery phase checklists. |
| [`offline-sync-plan.md`](mobile/offline-sync-plan.md) | **Draft** | Architecture specification for local-first optimistic mutations, mutation queue serialization via AsyncStorage, and background network reconciliation. |

---

## Conventions & Standards

1. **File Naming**: All plans follow lowercase kebab-case (`kebab-case-plan.md`).
2. **Domain Grouping**: Placed into dedicated subfolders (`architecture/`, `mobile/`, etc.) rather than scattered at repository root or inside package directories.
3. **Immutability of Applied Migrations**: Domain plans describe the *intent and rationale* of schemas. Database migrations in [`db/migrations/`](../db/migrations/) remain the ultimate source of truth for runtime database structure.
