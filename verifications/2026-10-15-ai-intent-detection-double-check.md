# Verification: AI Intent Detection & Defensive Architecture Double-Check

**Date:** 2026-10-15  
**Verdict:** PASS  
**Scope:** `server/src/ai/intent-context.ts`, `server/src/ai/gemini-llm.provider.ts`, `server/src/config/env.ts`, `server/src/ai/ai.module.ts`, `.env.example`, `server/test/ai-intent-context.test.ts`

---

## 1. Context & Scope

Following the implementation of the AI assistant features, this audit verified:
1. **AI-Driven Intent Detection**:
   - Decoupled `GeminiLlmProvider` from the predefined static word arrays (`EXPENSE_WORDS`, `INCOME_WORDS`, `BALANCE_WORDS`, `BUDGET_WORDS`, `GOAL_WORDS`, `QUESTION_WORDS`, `SPENDING_WORDS`).
   - Replaced keyword-based context pruning with `buildAiContext` and `buildAiSystemInstructions`, supplying complete authorized financial context (snapshot and monthly summary) to Gemini.
   - Structured JSON response schema requiring the model to classify its detected intent across all 10 supported languages (`RECORD_TRANSACTION`, `QUERY_BALANCES`, `QUERY_SPENDING`, `QUERY_BUDGETS`, `QUERY_GOALS`, `GENERAL_ASSISTANCE`).
2. **Defensive API & Fallback Architecture**:
   - Sanitizing markdown wrappers via `cleanJsonText`.
   - Runtime validation on model JSON via `rawGeminiResponseSchema` using Zod.
   - Immediate failover from rate-limited primary model (`gemini-3.8-flash` on HTTP 429) to high-throughput fallback model (`gemini-3.1-flash-lite`) without burning retries.
   - Exponential backoff with random jitter on HTTP 50x / timeouts.
   - Deterministic offline fallback (`executeDeterministicIntent`) when external models are unavailable or unconfigured.

---

## 2. Codebase Health Sweep (Phase 1)

1. **Dead Code & Dangling References**:
   - `buildAiContext` and `buildAiSystemInstructions` are cleanly exported and consumed by `GeminiLlmProvider`.
   - `detectUserIntent` and `groupContextForAi` are retained specifically for `MockLlmProvider` and `executeDeterministicIntent` for offline/mock execution.
2. **Duplicated Logic**:
   - Centralized prompt instructions and structured JSON response parsing inside `intent-context.ts`.
3. **Inefficient Data Access**:
   - Concurrently fetched `walletSnapshot` and `monthSummary` via `Promise.all` in `buildAiContext`.
4. **Invariant Alignment (AGENTS.md & CLAUDE.md)**:
   - **Money is never a JS Number**: Transferred as strings, validated via `aiTransactionDraftSchema`, parsed via `parseMoney`/`formatMoney`. Zero calls to `Number(amount)`.
   - **Derived values never cached**: Account balances, budget spend, and savings goal progress are read dynamically on read.
   - **Access control (AC-01 through AC-05)**: VIEWER-only access prevents draft proposals both at prompt level and in `AiService.acceptedProposal`.
   - **Currency Isolation (BR-13)**: Prompts and schemas enforce exact currency match to target account.
   - **Zero AI-Authorship Trailers**: Clean commit and documentation history.

---

## 3. Verification Commands & Results (Phase 2)

### 1. Build Server Package
- **Command:** `rtk npm run build -w @sora/server`
- **Output:** Exit 0 (clean compilation)
- **Verdict:** PASS

### 2. Run Server Unit Tests
- **Command:** `rtk npm test -w @sora/server`
- **Output:**
  ```text
  ℹ tests 104
  ℹ suites 46
  ℹ pass 104
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 0
  ℹ todo 0
  ```
- **Verdict:** PASS

### 3. Run Contracts Unit Tests
- **Command:** `rtk npm test -w @sora/contracts`
- **Output:**
  ```text
  ℹ tests 176
  ℹ suites 49
  ℹ pass 176
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 0
  ℹ todo 0
  ```
- **Verdict:** PASS

### 4. Contract Parity Audit
- **Command:** `node scripts/check-contract-parity.mjs`
- **Output:** `140/140 parity checks passed`
- **Verdict:** PASS

### 5. Repository-Wide Typecheck
- **Command:** `rtk npm run typecheck`
- **Output:** Exit 0 across all workspaces (`@sora/contracts`, `@sora/server`, `@sora/mobile`, and `scripts/seed`).
- **Verdict:** PASS

### 6. Agent Skills Parity Check
- **Command:** `npm run agents:check`
- **Output:** `agent skills in sync: 11 skills in .agents/skills`
- **Verdict:** PASS

---

## 4. Summary & Status

All automated checks and architectural invariants pass cleanly with zero regressions. The AI assistant pipeline is decoupled from static word arrays and validated end-to-end.

