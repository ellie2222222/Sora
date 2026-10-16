# Test plan: AI assistant

**Stories:** SRS §9 AI-US-01 Ask about a wallet · AI-US-02 Record a spend by describing it · AI-US-03 Keep and remove conversations
**Contract:** API spec §17 AI assistant
**Rules:** BR-05 (answers use the wallet's derived figures, never the assistant's own arithmetic), BR-06, BR-07 (no proposal in a currency other than the account's), AC-01 (another user's conversation reads as absent), rule 1 (amounts parsed exactly)
**Code under test:** `server/src/ai/` (including `MockLlmProvider`), the `ai_conversations`/`ai_messages` tables in `db/migrations/001_schema.sql`, `mobile/src/features/chat/`, `mobile/src/app/store/api/aiApi.ts`

## Objectives

1. The assistant only proposes. Nothing moves until the user confirms, and a confirmation records exactly one transaction.
2. It reads only wallets the asker belongs to, and only that user's conversations.
3. A VIEWER can ask, but is never offered a write.

## Test data & environment

- The server runs with the mock LLM provider (no network; `setup.ts` blocks `fetch`).
- `integration.ai.test.ts` registers an owner, a viewer and a stranger, with a VND cash account at `500000` ([integration.ai:18](../../server/test/integration.ai.test.ts#L18)).
- Message-shape constraints are probed in [002_ai_messages.sql](../../db/tests/002_ai_messages.sql).

## Test cases

| ID | Story | Scenario | Type | Expected result | Automated by | Status |
|---|---|---|---|---|---|---|
| TC-AI-01 | AI-US-02 | "Spent 65k … from Cash", then confirm, then confirm again | Integration | Proposal `PENDING` with no money moved; confirm 200, `CONFIRMED`, transaction `65000.0000`, balance `435000.0000`; second confirm 409 `AI_ACTION_NOT_PENDING` | [integration.ai:48](../../server/test/integration.ai.test.ts#L48) | Covered |
| TC-AI-02 | AI-US-02 | Ambiguous account; currency not the account's | Integration | No action; the reply names the choice or the currency | [integration.ai:74](../../server/test/integration.ai.test.ts#L74) | Covered |
| TC-AI-03 | AI-US-02 | Dismiss, then confirm | Integration | Dismiss 200 `DISMISSED`; confirm 409 `AI_ACTION_NOT_PENDING` | [integration.ai:84](../../server/test/integration.ai.test.ts#L84) | Covered |
| TC-AI-04 | AI-US-02 | VIEWER asks to record a spend | Integration | 201 with `action: null` | [integration.ai:107](../../server/test/integration.ai.test.ts#L107) | Covered |
| TC-AI-05 | AI-US-02 | Spend request on an archived wallet; confirm after the caller's role was lowered to VIEWER | Integration | No proposal; confirm 403 with nothing recorded | [integration.assistant:35](../../server/test/integration.assistant.test.ts#L35), [integration.assistant:59](../../server/test/integration.assistant.test.ts#L59) | Covered |
| TC-AI-06 | AI-US-01 | Ask for a balance; page the history | Integration | The answer quotes the derived balance (`435,000 VND`); messages newest first, `hasMore` set | [integration.ai:94](../../server/test/integration.ai.test.ts#L94) | Covered |
| TC-AI-07 | AI-US-01 | Ask "how much did I spend" on a wallet with two currencies and a transfer | Integration | Per-currency figures, never summed; the transfer not counted as spending | [integration.assistant:81](../../server/test/integration.assistant.test.ts#L81) | Covered |
| TC-AI-08 | AI-US-01/03 | Stranger asks about the wallet, reads someone else's conversation, lists conversations | Integration | 404 `WALLET_NOT_FOUND`; 404 `AI_CONVERSATION_NOT_FOUND`; only their own conversations | [integration.ai:114](../../server/test/integration.ai.test.ts#L114) | Covered |
| TC-AI-09 | AI-US-03 | Delete a conversation | Integration | 200; its messages then 404 | [integration.ai:126](../../server/test/integration.ai.test.ts#L126), [integration.assistant:105](../../server/test/integration.assistant.test.ts#L105) | Covered |
| TC-AI-10 | AI-US-02 | Amount parsing: `65k`, grouped digits, no amount, zero, Vietnamese with or without diacritics | Unit | Exact amounts, never via a float; nothing when absent; never zero | [ai-mock-provider:13](../../server/test/ai-mock-provider.test.ts#L13), [:22](../../server/test/ai-mock-provider.test.ts#L22), [:27](../../server/test/ai-mock-provider.test.ts#L27) | Covered |
| TC-AI-11 | AI-US-02 | Message rows written directly | DB probe | Blank title, unknown role, empty content, an action on a user message, an action without payload, a confirmed action with no transaction, unknown action type: all rejected | [002_ai_messages:56](../../db/tests/002_ai_messages.sql#L56)–[:99](../../db/tests/002_ai_messages.sql#L99) | Covered |
| TC-AI-12 | AI-US-01 | Guest opens the assistant; signed-in user opens chat offline | Mobile unit / E2E | Guest told it needs an account and offered sign-in, the input shown but disabled; history readable offline, sending disabled | offline and view-only rule: [chatAvailability:7](../../mobile/src/features/chat/chatAvailability.test.ts#L7), [:11](../../mobile/src/features/chat/chatAvailability.test.ts#L11), [:15](../../mobile/src/features/chat/chatAvailability.test.ts#L15) | Partial — the guest prompt is rendering only (`AiChatScreen.tsx`) and needs E2E |
| TC-AI-13 | API §2.4 | AI routes without a bearer | Integration | 401 | [integration.auth:127](../../server/test/integration.auth.test.ts#L127) (every mounted route, AI included) | Covered |
| TC-AI-14 | AI-US-02 | Read a stored proposal in another language than it was drafted in | Integration | `action.categoryName` is the category's current name in the reader's locale (spec §17) | [integration.assistant:128](../../server/test/integration.assistant.test.ts#L128) | Covered |
| TC-AI-15 | AI-US-01 | Gemini answers first time; or the primary returns 503 twice; or times out; or is rate limited | Unit (scripted `fetch`) | One call when it answers. A 503 retries once after at least `Retry-After`, then the fallback model answers. A timeout or 429 goes straight to the fallback model | [ai-intent-context:356](../../server/test/ai-intent-context.test.ts#L356), [:363](../../server/test/ai-intent-context.test.ts#L363), [:371](../../server/test/ai-intent-context.test.ts#L371), [:378](../../server/test/ai-intent-context.test.ts#L378) | Covered |
| TC-AI-16 | AI-US-01 | Every model fails, is rate limited or times out; a 401/403; a 400; a safety block; the budget already spent | Unit | `AI_PROVIDER_UNAVAILABLE` / `_BUSY` / `_TIMEOUT`, never an invented reply. A 401/403 or a safety block is called once and stops; a 400 goes to the fallback model once. No call starts once the budget is spent | [ai-intent-context:384](../../server/test/ai-intent-context.test.ts#L384), [:391](../../server/test/ai-intent-context.test.ts#L391), [:397](../../server/test/ai-intent-context.test.ts#L397), [:403](../../server/test/ai-intent-context.test.ts#L403), [:411](../../server/test/ai-intent-context.test.ts#L411), [:417](../../server/test/ai-intent-context.test.ts#L417), [:436](../../server/test/ai-intent-context.test.ts#L436), [:450](../../server/test/ai-intent-context.test.ts#L450) | Covered |
| TC-AI-17 | AI-US-01 | The model fails, then the client retries under the same `Idempotency-Key` | Integration | 503 with nothing saved. The retry is 201 and a replay returns the same rows: one exchange stored | [integration.ai:149](../../server/test/integration.ai.test.ts#L149) | Covered |
| TC-AI-18 | AI-US-01 | The client disconnects while the model is working | Unit + Integration | The model call is aborted (`AI_REQUEST_CANCELLED`); no message saved | [ai-intent-context:442](../../server/test/ai-intent-context.test.ts#L442), [integration.ai:168](../../server/test/integration.ai.test.ts#L168) | Covered |
| TC-AI-19 | AI-US-01 | A send in the app: creating the chat, waiting, failing, retrying | Mobile unit | Real stage only. One send at a time per chat, and a send in one chat never replaces another chat's unsent message. A failure keeps the text, says why (offline only when the device has no internet, else the server is unreachable), and offers Retry (the same request, so the same key) or only Edit when a retry can't succeed. A replayed answer is added to the chat once | [chatExchange:12](../../mobile/src/features/chat/chatExchange.test.ts#L12), [:17](../../mobile/src/features/chat/chatExchange.test.ts#L17), [:25](../../mobile/src/features/chat/chatExchange.test.ts#L25), [:34](../../mobile/src/features/chat/chatExchange.test.ts#L34), [:56](../../mobile/src/features/chat/chatExchange.test.ts#L56), [:63](../../mobile/src/features/chat/chatExchange.test.ts#L63), [:72](../../mobile/src/features/chat/chatExchange.test.ts#L72), [aiMessages:28](../../mobile/src/app/store/api/aiMessages.test.ts#L28) | Covered |
| TC-AI-20 | AI-US-01 | Gemini returns its JSON encoded twice, with leaked `\"`/`
`, or with Markdown | Unit | Parsed; the bubble shows plain quotes, real line breaks and `• ` items | [ai-intent-context:548](../../server/test/ai-intent-context.test.ts#L548), [:557](../../server/test/ai-intent-context.test.ts#L557) | Covered |

## Gaps, by risk

1. **TC-AI-12**: the offline rule is now `features/chat/chatAvailability.ts` and unit-tested; the guest sign-in prompt is a plain render branch with no logic to extract, so only an E2E flow can prove it.
