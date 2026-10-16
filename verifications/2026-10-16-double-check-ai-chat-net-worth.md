# Double-check of this session's AI reliability, chat, account tint and net worth work

**Date:** 2026-10-16T04:33:57Z
**Method:** double-check skill
**Verdict:** PASS
**Scope:** Every uncommitted change from this session (`git status`):
- the Gemini reply budget and failure codes, cancellation, and the removed intent pipeline;
- the chat lifecycle and UI;
- the account tints;
- the net worth panel.

Phase 1 covered those files. Phase 2 checked `aif-sdlc-checklist.md` §6.

**Files touched:**
- Server: `server/src/ai/{intent-context.ts, gemini-llm.provider.ts, mock-llm.provider.ts}`, `server/src/config/env.ts`, `server/test/{ai-intent-context.test.ts, exchange-rate.service.test.ts}`
- Mobile:
  - `mobile/src/features/chat/{chatExchange.ts, chatExchange.test.ts, screens/AiChatScreen.tsx, components/ChatMessageItem.tsx, components/ThinkingIndicator.tsx}`
  - `mobile/src/app/store/api/aiApi.ts`, `mobile/src/services/api/ai.ts`
  - `mobile/src/features/accounts/{netWorth.ts, components/NetWorthSummary.tsx, components/AccountsOverview.tsx}`
  - `mobile/src/design-system/colors.ts`
- Docs: `docs/API_SPECIFICATION.md` §17.5, `SDS.md` §6.2, `plans/architecture/ai-chat-assistant-plan.md` §0

**Related reports:**
- `2026-10-16-net-worth-panel.md`
- `2026-10-16-ai-reliability-chat-and-account-tints.md`
- `2026-10-16-ai-gemini-prompt-and-reply-parsing.md`

## Method

Phase 1: a read-only Explore agent swept the scoped files for six categories (dead code, duplication, CLAUDE.md rule violations, stale references, docs drift, logic risks). I grepped each finding again before acting on it.

Phase 2:
```
npm run typecheck; node scripts/check-contract-parity.mjs; npm run agents:check
npm run test -w @sora/mobile
DATABASE_URL=postgresql://scratch@127.0.0.1:55437/scratch_audit_6d1345 npm run test -w @sora/server
cd mobile && npx expo export --platform android --output-dir <scratchpad>/expo-export
```

## Findings

1. **A failed message could be lost.**
   - Chat state held one pending exchange for the whole screen, and the send guard looked only at in-flight.
   - So a send in chat B silently replaced chat A's failed, unsent message.
   - Also, a send in progress in a chat you'd left disabled input in the chat you were viewing, with no reason shown.
   - → fixed
2. **A new chat's answer could vanish.**
   - Its messages query starts when the chat is created. If that query is still loading when the answer arrives, `prependExchange` has no page to add to, and the query then lands without the new rows.
   - → fixed
3. **A safety-blocked reply was retried.**
   - A 200 with `promptFeedback.blockReason`, or a `finishReason` of SAFETY and similar, was classed as transient and tried up to four times.
   - → fixed
4. **A 400 stopped every attempt**, though it can be one model rejecting the request shape (`responseSchema`). → fixed: the fallback model gets it once
5. **The same values were defined in several places.**
   - The intent list was written three times (`UserIntent`, the Zod enum, the response schema).
   - Default model names were in four places.
   - The thinking indicator copied the assistant bubble's style.
   - `'85%'` appeared three times.
   - The net worth skeleton repeated the panel style.
   - → fixed
6. **Skeletons didn't match their content.** The account-row skeleton had the old row padding and no card outline; the chat skeleton height used `spacing.md` while the bubble pads with `sm`. → fixed
7. **Rule violations (CLAUDE.md MB-01, MB-06, rule 11).**
   - `role: any` (`mock-llm.provider.ts:63`).
   - A literal opacity of 0.3 in the dots.
   - The "what" section banners in both AI provider files.
   - The 3–6 line comment blocks I wrote this session, one of which narrated history.
   - → fixed
8. **Exports only used inside their own file:** `buildAiSystemInstructions`, `callSingleModel`, `AttemptOutcome`, `AI_SEND_GRACE_MS`. → export removed
9. **Docs drift.**
   - SDS §6.2 lacked the four `AI_PROVIDER_*` / `AI_REQUEST_CANCELLED` codes.
   - The plan's "as built" section still said "Thinking… line" and didn't mention the Gemini provider or the no-fallback rule.
   - → fixed
10. **Stale references** to the removed pipeline (`ai.thinking`, `intent-detector`, `GEMINI_MODEL_INTENT`, `PositionFigure`, `@google/genai`): none left in live code or docs; only dated reports and build output mention them. → PASS
11. **Deadline:** each call's timeout is capped by what remains of the budget; backoff is skipped when it wouldn't leave a full attempt; sleep is abortable. → PASS
12. **Barrels:** the chat and accounts barrels export only what is used outside the folder. → PASS

## Fixes Applied

- **Per-chat exchanges.**
  - `chatExchange.ts` adds `PendingByChat`/`withExchange`/`chatKey`, and `startedAt` so the "taking longer" timer counts from the send.
  - `AiChatScreen.tsx` keeps one exchange per chat; input is blocked only by the viewed chat's own send.
  - Tests: `chatExchange.test.ts` (one exchange per chat, retry timing).
- **Missing answer in a new chat:** `aiApi.ts` `sendAiMessage` now also invalidates `{ type: 'AiMessage', id: conversationId }`.
- **Safety block / 400:**
  - `intent-context.ts`: a blocked reply is `permanent`; a 400 is `skip-model: rejected`.
  - Tests: `ai-intent-context.test.ts` "stops at a safety block…" (1 call), "gives a 400 to the fallback model once…", and "never retries a 401 or 403".
- **One definition each:**
  - The `USER_INTENTS` derived from `UserIntent` now feed both enums.
  - `env.ts` `GEMINI_MODEL` defaults to `gemini-3.8-flash`; the provider and `GeminiConfig` require the models (fixtures updated).
  - `ThinkingIndicator` renders inside `ChatBubble`; `BUBBLE_MAX_WIDTH`; `panelStyle(theme)`.
  - The dots dim to `theme.opacity.disabled`.
- Comments trimmed to one or two lines of why. The banners and the `any` are gone.
- **Docs:** spec §17.5 retry rule, SDS §6.2 catalogue, plan §0.

Re-verified after the fixes:

| Command | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `check-contract-parity.mjs` | 140/140 |
| `agents:check` | 11 skills in sync |
| mobile | 748 pass, 0 fail |
| server (scratch DB, integration included, 0 skipped) | 303 pass, 0 fail |
| `expo export --platform android` | exit 0, 7.9MB Hermes bundle |

## Follow-ups resolved (2026-10-16T04:49:57Z)

- **`mock-llm.provider.ts`:**
  - `groupContextForAi` and its `buildSystemInstructions` are removed. `executeIntent(detected, request)` reads the detected intent directly and fetches only what that intent answers from.
  - Regression test `ai-intent-context:216`: six message kinds, each calling `walletSnapshot()`/`monthSummary()` at most once.
  - The three tests of the removed builder are gone.
  - 13 exports with no importer are now module-private.
- **`GroupedAiContext`:** `intent`, `confidence`, `entities` and `financialData.balances` are removed. They were written and never read.
- **`AccountDetailModal.tsx`:** uses `TransactionType.INCOME`/`EXPENSE`; `AccountDetailModalProps` is no longer exported.
- **Docs:**
  - RUNBOOK Configuration covers the Gemini settings and states that the keyword assistant is never a fallback.
  - RUNBOOK Troubleshooting explains `AI_PROVIDER_*` and shows how to read the `ai.attempt`/`ai.failed` log lines by `rid`.
  - README Setup points to it.
- **Test-plan links:**
  - Re-pointed after this session's edits shifted these test files: `ai-intent-context`, `integration.ai`, `exchange-rate.service`, `chatExchange`, `colors`.
  - Check: 687 links into `.test.ts` files. All land on a test start except the same 8 that deliberately point inside a test (unchanged since `2026-10-16-transaction-status-contributions-kept.md`).
- **Results:**

| Command | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `check-contract-parity.mjs` | 140/140 |
| mobile | 748 pass |
| server (scratch DB, 0 skipped) | 301 pass (−3 removed builder tests, +1 fetch-once test) |

## Follow-ups

- Still open: an on-device visual check of the tinted cards, the net worth panel and the chat (both modes, five palettes, 320dp, de/ru). No emulator in this session.
