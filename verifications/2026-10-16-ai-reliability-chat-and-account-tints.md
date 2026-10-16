# AI reply budget, honest failures, chat lifecycle, and account identity tints

**Date:** 2026-10-16T04:10:52Z
**Method:** ad hoc
**Verdict:** PASS (code paths exercised by automated tests). On-device visual check: BLOCKED, no emulator run this pass.
**Scope:** The owner's brief:
- the AI timeout and fallback failure;
- the chat readability and its loading/failure states;
- distinct account card colours;
- animations.

The owner chose "tinted cards, amend the guide" over the guide's divider list.

**Files touched:**
- Contracts: `responses.ts` (4 codes, 499/504), `schemas.ts` (`AI_REPLY_BUDGET_MS`).
- Server:
  - `ai/intent-context.ts`, `ai.service.ts`, `ai.controller.ts`, `llm-provider.ts`, `gemini-llm.provider.ts`;
  - `common/app-error.ts`;
  - tests `ai-intent-context`, `integration.ai`.
- Mobile:
  - chat: `features/chat/{chatExchange.ts, components/ThinkingIndicator.tsx, ChatMessageItem.tsx, ChatInputBar.tsx, screens/AiChatScreen.tsx}`;
  - store and API: `app/store/api/{aiApi.ts, aiMessages.ts}`, `services/api/ai.ts`, `utils/errors.ts`;
  - design system: `design-system/{colors.ts, index.ts}`;
  - accounts: `features/accounts/{accountTint.ts, components/AccountBadge.tsx, AccountsOverview.tsx, AccountDetailModal.tsx}`;
  - 10 locales;
  - tests `chatExchange`, `aiMessages`, `accountTint`, `colors`.
- Docs: API spec §2.6 and §17/§17.5, `ERROR_CODES.md` §10, `DESIGN_GUIDELINES.md` (Lists, Color, Motion), SRS AI-US-01, test plans `ai.md`, `accounts.md`, `README.md`.

**Related reports:** `2026-10-16-ai-gemini-prompt-and-reply-parsing.md`

## Method

```
npm run typecheck; node scripts/check-contract-parity.mjs; npm run agents:check
npm run test -w @sora/contracts; npm run test -w @sora/mobile
DATABASE_URL=postgresql://scratch@127.0.0.1:55437/scratch_audit_6d1345 npm run test -w @sora/server
```

## Findings

Root causes, read from the code rather than taken from the log:

1. **Timeout budgets did not line up.**
   - The app waited 15 s (`env.requestTimeoutMs`, default `DEFAULT_TIMEOUT_MS = 15000`, applied to every request).
   - The server's worst case was about 109 s: primary 3 × 25 s plus 1 s + 2 s backoff, then fallback 2 × 15 s plus 1 s.
   - So the app gave up long before the server finished. The server kept calling Gemini, then saved the exchange (from the mock, see 2) with nobody listening.
   - → fixed, PASS
2. **Silent mock fallback.**
   - `GeminiLlmProvider` passed `() => new MockLlmProvider().reply(request)` as the fallback, so a Gemini outage returned the keyword assistant's canned text as if it were the model's.
   - That is the "Who are u → I can record an expense…" reply in the owner's screenshot.
   - → removed, PASS
3. **No cancellation.**
   - A client disconnect didn't stop the server loop: provider calls, retries and the final save all still ran.
   - → fixed, PASS
4. **The app's failure path.**
   - A failure showed a toast and gave the text back, but a new chat's id was dropped when the create succeeded and the send failed. The retry then opened a second conversation.
   - There was no inline retry, and "Thinking…" was the only status.
   - → fixed, PASS
5. **Account rows** sat directly on the black background with grey icons, as the screenshot shows. → tinted cards, PASS

### What changed, with the check that proves it

| Behaviour | Evidence |
|---|---|
| One budget: `AI_REPLY_BUDGET_MS` 30 s for the server, with 2 s reserved for saving; the app waits budget + 10 s | `services/api/ai.ts` `timeout`; `ai.service.ts` `deadline` |
| The first attempt answers in one call | `ai-intent-context:405` |
| A 503 retries once after at least `Retry-After`, then the fallback model answers | `:412` (sleep ≥ 1000 ms; calls p, p, f) |
| A timeout or a 429 skips straight to the fallback model, with no sleep | `:420`, `:427` |
| All fail → `AI_PROVIDER_UNAVAILABLE` / `_BUSY` / `_TIMEOUT`, never a reply | `:433`, `:440`, `:446` |
| A 400/401 is called once and never retried | `:452` |
| No attempt starts with the budget spent | `:460` |
| A disconnect aborts the in-flight call → `AI_REQUEST_CANCELLED` (499) | `:466`; integration `integration.ai:168` (socket destroyed after 200 ms → provider saw abort, 0 rows) |
| A real `GeminiLlmProvider` surfaces the error, not the mock | `:474` |
| Failure saves nothing; a retry under the same `Idempotency-Key` gives 201, and a replay returns the same `userMessage.id`, so 2 rows in total | `integration.ai:149` |
| App: one send at a time; a failure keeps the text, says why, and offers Retry (identical body, so the same key) or Edit | `chatExchange:16`, `:24`, `:39`, `:46`, `:51` |
| App: a replayed exchange is inserted into the chat once | `aiMessages:28` |
| Status shows real stages only: `starting` (creating the chat), `waiting`, then `slow` after 10 s | `chatExchange:11`; `AiChatScreen.tsx` `STAGE_LABEL_KEY` |
| Logs carry `rid` (the app sends `x-request-id`) for every attempt (`ai.attempt model= attempt= outcome= ms=`), retry delay and reason, `ai.failed code=`, `ai.cancelled`, and `ai.persisted … ms=`, with no prompt or message text | `intent-context.ts`, `ai.service.ts` |
| An account keeps one tint from its id, in both modes, and every tint is used | `accountTint:10`, `:17` |
| `text`/`textMuted` ≥ 4.5:1 and the badge ≥ 3:1 on every tint, in every palette and mode; each card stands off the background (≥ 1.08:1; measured dark 1.19–1.31, light 1.09–1.14, plus a hairline border) | `colors:284` |

| Command | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `check-contract-parity.mjs` | 140/140 |
| `agents:check` | in sync |
| contracts | 176 pass |
| mobile | 732 pass (includes `tokens-usage`, locale parity and plurals) |
| server (scratch DB) | 301 pass |

## Fixes Applied

Listed in Findings. The UI changes:
- account cards: tint `surface`, `radius.lg`, hairline border, `AccountBadge` in the tint `accent`, balance at `fontSize.lg`;
- a staggered `FadeInDown`, on mount only (240 ms, 40 ms stagger, capped at 5);
- the net-worth figure fades in when it changes (180 ms), with no number tweening;
- chat bubbles: user on `primary`, assistant on `surfaceElevated` with a hairline, tail corner `radius.xs`;
- `• ` lines get a hanging indent, and a newly arrived answer fades in;
- the thinking dots pulse only while a message is out;
- the send button shows a spinner while busy.

Reanimated 4.5 layout animations default to `ReduceMotion.System`, and the dots check `useReducedMotion()`.

## Follow-ups

- **On-device check not done** (BLOCKED, no emulator run): the tinted cards in both modes and five palettes, the chat at phone width in the longest locale (de/ru), keyboard overlap, and Reduce Motion. The contrast and token rules are machine-checked; the look is not.
- **Leaving the chat mid-send:** the pending state is local to the screen, so leaving clears it. The answer still reaches the cache if it arrives. There is no automated UI test for this; it would need E2E.
- A chat created for a send that then fails stays in history, empty. This was already the behaviour; not changed.
- `mobile/package.json` has an `expo ~57.0.29 → ~57.0.30` change this pass did not make. Left as is.
- Not run against live Gemini (no key).
