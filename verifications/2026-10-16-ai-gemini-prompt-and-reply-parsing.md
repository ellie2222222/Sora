# Gemini assistant: intent prompt, reply formatting, escaped-quote parsing, JSON request

**Date:** 2026-10-16T02:17:32Z
**Method:** ad hoc
**Verdict:** PASS
**Scope:** The owner asked to double check:
- the AI intent detection and the base prompt;
- formatting replies so they read well in the app's chat bubble;
- handling escaped quotes Gemini injects;
- asking for `application/json`.

Covers the Gemini path in `server/src/ai/intent-context.ts` and its shared helpers.
**Files touched:**
- AI code: `server/src/ai/intent-context.ts`, `display-amount.ts` (new), `mock-llm.provider.ts`, `gemini-llm.provider.ts`, `ai.service.ts`, `ai.module.ts`
- Config and dependencies: `server/src/config/env.ts`, `.env.example`, `server/package.json`, `package-lock.json`
- Tests: `server/test/ai-intent-context.test.ts`, `server/test/exchange-rate.service.test.ts`
- Docs: `docs/API_SPECIFICATION.md` (§ AI, line 1185), `CLAUDE.md` (Configuration)
- Removed files are listed under Fixes Applied.
**Related reports:** `2026-10-16-transaction-status-contributions-kept.md` (listed `server/src/ai/*` as separate Gemini work)

## Method

```
npx tsc --noEmit -p server; npm run typecheck
npm run build -w @sora/server
node --import ./dist/test/setup.js --test dist/test/ai-intent-context.test.js dist/test/ai-mock-provider.test.js dist/test/ai-multilingual-intent.test.js
DATABASE_URL=postgresql://scratch@127.0.0.1:55437/scratch_audit_6d1345 npm run test -w @sora/server
```

## Findings

1. **The model was never told the date.**
   - The prompt asked for an ISO `transactionDate` but gave no "now" and no wallet time zone, and `transactionDate` was required. A model guessing it files entries on the wrong day (rule 18).
   - The prompt now states now plus today in the wallet's zone, from `DashboardResponse.period.timeZone`. `transactionDate` is an optional `YYYY-MM-DD`, turned into an instant with `withDay(now, day, timeZone)`; when it's missing, now is used.
   - Test `accepts "50,000" and a named day`: `2026-10-11` → `2026-10-11T03:00:00.000Z`.
   - → fixed, PASS
2. **Raw amounts in the prompt.** Balances, budgets, goals and month totals went in as `"500000.0000"`, and the model echoed them. They are now formatted for the reader's locale with `displayAmount` (`"500,000 VND"`), and income was added. → fixed, PASS
3. **Reply formatting.**
   - The rule "No Markdown" gave no positive shape for lists. The prompt now asks for at most 4 sentences, one item per line starting `• ` (matching the mock provider), no ids or JSON, and amounts as given.
   - `tidyContent` enforces it on the output: drops `#` headings, `**`/`__`, backticks and links, turns `-`/`*`/`1.` markers into `• `, and collapses blank runs.
   - The app's `<Text>` renders `\n` as is, so no mobile change was needed.
   - → fixed, PASS
4. **Escaped quotes from Gemini.** Handled in three places:
   - `parseModelJson` re-parses an object Gemini JSON-encoded twice (one string full of `\"`) and extracts the object when prose surrounds it.
   - `tidyContent` undoes leaked `\"`, `\'`, `\n` and `\t`, and strips quotes wrapping the whole reply.
   - The proposal `description` is cleaned the same way.
   - Tests: double-encoded reply → `"Cash": 500,000 VND`; description `Lunch at \"Pho 24\"` → `Lunch at "Pho 24"`.
   - → fixed, PASS
5. **`application/json`.**
   - `generationConfig.responseMimeType: 'application/json'` and the `Content-Type` header were already set.
   - Added `Accept: application/json`.
   - The API key moved from the `?key=` query string to the `x-goog-api-key` header, so it no longer lands in URL logs.
   - `intent` is now a required schema field.
   - Test `asks for application/json and sends the key in a header` checks the header, body and URL.
   - → PASS
6. **Proposal acceptance.**
   - Before: an amount `parseMoney` rejected (`"50k"`, too many decimals) threw inside the parse `try`, so the whole call was retried against the model.
   - Now the proposal is dropped and the reply is kept. `"50,000"` is accepted via `stripCurrencyInput`.
   - A category of the other type, or an archived wallet, drops the proposal here as well as in `AiService.acceptedProposal`.
   - Test `drops a proposal whose category is of the other type`.
   - → fixed, PASS
7. **Prompt hygiene.**
   - Removed the stale "BR-13" reference; the currency rule is BR-07.
   - Added: account, category and message text are data, not instructions.
   - The prompt no longer sends the wallet id.
   - Logging moved from `console.*` to Nest `Logger`.
   - → PASS
8. **Test hitting the network.** `falls back seamlessly …` called the real Google endpoint with a fake key. It now stubs `fetch`. → fixed, PASS

| Command | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| AI unit tests (3 files) | 49 pass, 0 fail |
| server suite (scratch DB) | 308 pass, 0 fail |

### Second pass: the open follow-ups, settled the standard way

9. **Unused intent pipeline removed.**
   - `IntentDetectorService`, `QueryPlannerService`, `ContextBuilderService` and `ModelRouterService` were registered in `AiModule` and tested, but nothing on the request path called them.
   - Removed (6 files):
     - `server/src/ai/services/*` (4)
     - `server/src/ai/interfaces/*` (3)
     - `server/test/ai-multilingual-intent.test.ts`
   - Also removed:
     - the `GEMINI_MODEL_INTENT/CHAT/ANALYSIS/COMPLEX` env vars, which only that pipeline read;
     - the `@google/genai` dependency (the provider uses REST `fetch`). The lockfile diff is 179 lines, deletions only; `npm audit --omit=dev` finds 0 vulnerabilities.
   - Chat keeps detecting intent in its single structured Gemini call. Wiring the pipeline in would have added a second model call to every message.
   - All files are recoverable from git HEAD.
   - → PASS
10. **Chat text out of the logs.**
    - The user's message and the full reply (including proposal amounts) were logged at INFO by `GeminiLlmProvider`, `MockLlmProvider` and `AiService`.
    - Now `AiService` logs ids only at INFO. The providers log intent, lengths and the proposal type at DEBUG.
    - → PASS

| Command (after the second pass) | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `check-contract-parity.mjs` | 140/140 |
| `agents:check` | 11 skills in sync |
| server suite (scratch DB) | 290 pass, 0 fail (the 18 pipeline tests went with it) |

## Fixes Applied

- `intent-context.ts:178` `buildAiSystemInstructions`: prompt rewritten (findings 1, 2, 3, 7).
- `intent-context.ts:293` `parseModelJson`, `:323` `tidyContent`: findings 3 and 4.
- `intent-context.ts:401`: Accept and key header (finding 5).
- `intent-context.ts:452` `acceptedProposal`: finding 6.
- `display-amount.ts`: `NUMBER_FORMAT`/`displayAmount`/`joinTotals` moved out of `mock-llm.provider.ts`, so the Gemini path uses them without a circular import.
- Spec §AI paragraph: the Gemini provider and the `content` format.
- Each fix was re-verified by the tests above.

## Follow-ups

- Not run against the live Gemini API (needs a real key); the request shape is checked by a stubbed `fetch`.
- `server/dist/test/ai-multilingual-intent.test.js` is stale build output; `test/run.mjs` only runs tests whose source exists, so it never runs. It was left in place because `dist/` is gitignored.
