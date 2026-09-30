---
name: infra-audit
description: >-
  Scans the codebase and deployed infrastructure for optimization, reliability, and architectural
  improvement opportunities -- both quick wins (code-level) and strategic opportunities (design/patterns).
  Ranks findings by impact/effort and writes a report. Use when asked to "audit infrastructure", "find
  infrastructure improvements", or on a regular (e.g. quarterly) health-check cadence -- distinct from
  `double-check` (bugs in what exists) and `restructure` (where files live); this one is about whether the
  system's *design and operational posture* still fit its current scale and needs.
---

# Infrastructure Audit & Improvement Finder

Scans the codebase and deployed infrastructure for optimization, reliability, and architectural
improvement opportunities. Surfaces both quick wins (code-level improvements) and strategic opportunities
(design/patterns).

## Target

Audits the repo containing this `.claude/skills/infra-audit/` folder — resolve its root by walking up from
this file's location to the nearest repo boundary (e.g. `git rev-parse --show-toplevel` run from this
file's directory), regardless of which directory the invoking session's shell/CWD happens to be in. If the
user explicitly names a different target project in the same message, audit that instead — an explicit
instruction overrides this default. Absent that, never ask which project to scan; resolve it and proceed
straight to Phase 1's scope definition.

## When to Use

- Regularly (e.g. quarterly) to catch drift and emerging patterns
- After major refactors or new features to validate the new shape
- When onboarding to understand the system's current state and debt
- Before capacity/scaling conversations to have baseline metrics
- When adding new services or changing deployment targets

## What It Covers

**Code-Level Improvements**
- Duplicated patterns across modules (consolidation candidates)
- Inefficient data access (N+1 queries, missing indexes, avoidable round-trips)
- Dead code, unused exports, or unreachable branches
- Configuration scattered instead of centralized
- Inconsistent error handling or logging
- Missing input validation at system boundaries
- Tests that don't match their coverage claims

**Infrastructure & Architecture**
- Container/service sprawl or underutilized services
- Hardcoded values that should be config/env vars
- Missing observability (logging, metrics, tracing)
- Connection pooling, caching, or batching opportunities
- Security hardening (secrets management, least-privilege, audit logging)
- Documentation gaps in critical paths
- CI/CD pipeline inefficiencies (slow tests, flaky checks, missing gates)
- Database schema optimization (missing indexes, denormalization opportunities)
- Resource limits or quotas that are too loose/tight

**Patterns & Consistency**
- Design-pattern inconsistency (one feature follows pattern A, another follows pattern B)
- API contract drift (schema changes not reflected in types/docs)
- Testing strategy inconsistency (one feature has integration tests, another only unit tests)
- Dependency version drift (some packages pinned, others floating)

## How It Works

**Phase 1 — Scope Definition**
User picks what to audit:
- Narrow: a single service/feature/layer (quick, ~15 min)
- Medium: a subsystem or all of one type (a service, the frontend, the database layer) (30-45 min)
- Broad: entire infrastructure (1-2 hours, may require multiple passes)

**Phase 2 — Automated Scan**
Agent reads the codebase, configuration, CI/CD, and infrastructure-as-code (containers, orchestration
manifests, provisioning config, etc. — whatever this repo actually uses, discovered live rather than
assumed) looking for:
- Patterns (what repeats, what diverges)
- Metrics (file counts, dependency counts, test coverage %, code duplication %)
- Anomalies (dead code, unused config, unhandled error paths)
- Bottlenecks (O(n) lookups, serial operations, blocking calls)
- Inconsistencies (naming, error codes, logging levels, retry logic)

**Phase 3 — Prioritization**
Findings are ranked by impact/effort ratio:
- **Tier 1 (Quick wins)**: < 1 hour effort, immediate benefit (e.g., add a missing index, consolidate a
  duplicate function)
- **Tier 2 (Strategic)**: 1-2 days effort, significant architectural benefit (e.g., extract a shared
  service, refactor a test strategy)
- **Tier 3 (Debt)**: 2+ days effort, quality-of-life improvement (e.g., migrate a deprecated library,
  redesign a config system)

**Phase 4 — Reporting**
Each finding includes:
- **What** — the specific observation
- **Where** — file paths or component names, from this actual repo (verified live, not assumed)
- **Why** — the impact or risk if not addressed
- **Effort** — estimated person-days
- **How** — sketch of the fix (not full implementation, just direction)
- **Related** — other findings that depend on or conflict with this one

## Example Findings

These are illustrative shapes for how a finding should read — placeholder names throughout, since a real
finding names this repo's actual current files/modules, verified live, not a frozen example from a past
run of this skill.

**Code-level improvement (Tier 1)**:
```
Extra round-trip fetching a related count

What: A list view fetches its main entity, then issues a separate query for a related count/aggregate
that could ride along with the first request.
Where: <the real component/file>, <the real endpoint it calls>
Why: N+1 on every view of that list; combine into the single fetch via a join/aggregation stage instead.
Effort: 0.5 days (update the response shape, add the aggregation stage, update the consumer)
How: Fold the related count into the main response instead of a second fetch.
```

**Architecture (Tier 2)**:
```
Inconsistent retry/backoff strategy

What: Different clients in this codebase (a database client, an HTTP client, a queue consumer) each
implement their own retry/backoff logic, with different strategies and timeouts.
Where: <the real modules that each implement their own retry logic>
Why: Inconsistent behavior makes debugging harder; multiple different timeout/backoff patterns to reason
about instead of one.
Effort: 1 day (extract a shared retry-policy abstraction, apply it to all call sites)
How: Move all retry logic to one shared module with configurable strategies; use it everywhere.
```

**Debt (Tier 3)**:
```
Configuration system not centralized

What: Environment variables are read ad hoc in many different places; no single source for defaults.
Where: <the real modules reading env vars directly, enumerated by an actual grep, not assumed>
Why: Makes it hard to audit what config exists, hard to test with different configs, secrets scattered.
Effort: 2 days (extract a config module, move all env reading there, migrate call sites)
How: One config module owning all env reads at startup, passed around explicitly instead of re-read
ad hoc.
```

## Output Format

A report file with:
- **Audit date & scope** (what was looked at, why)
- **Summary stats** (files scanned, services, patterns found, findings by tier)
- **Tier 1 findings** (quick wins, can ship immediately)
- **Tier 2 findings** (strategic improvements, schedule for next sprint)
- **Tier 3 findings** (tech debt, track in backlog, revisit next quarter)
- **Cross-cutting themes** (if 3+ findings point to the same pattern, highlight it)
- **Dependencies** (X blocks Y, Z requires understanding of W first)

If this repo already has an established convention for recording audit/verification passes (a reports
directory, a template described in its own conventions doc), write the report there in that shape — same
field names, same file-naming/dating pattern already in use. If no such convention exists, write a dated
report somewhere sensible (ask the user where, if it's not obvious) rather than inventing a new location
silently.

## Notes

- This is **not** a code review of a PR — it's a health check of the whole system
- Findings are **suggestions**, not mandates — your backlog/priorities decide what lands
- Safe to run frequently; findings that are already-done or deliberately-deferred don't need action
- If a finding is closed (code already fixed, design decision made), mark it as such in the next report so
  it doesn't resurface
