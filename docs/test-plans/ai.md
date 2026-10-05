# Test plan: AI assistant

**Stories:** SRS §9 AI-US-01 Ask about a wallet · AI-US-02 Record a spend by describing it · AI-US-03 Keep and remove conversations
**Contract:** API spec §17 AI assistant
**Rules:** BR-05 (answers use the wallet's derived figures, never the assistant's own arithmetic), BR-06, BR-07 (no proposal in a currency other than the account's), AC-01 (another user's conversation reads as absent), rule 1 (amounts parsed exactly)
**Code under test:** `server/src/ai/` (including `MockLlmProvider`), migration `007_ai_conversations_and_messages.sql`, `mobile/src/features/chat/`, `mobile/src/app/store/api/aiApi.ts`

## Objectives

1. The assistant only proposes. Nothing moves until the user confirms, and a confirmation records exactly one transaction.
2. It reads only wallets the asker belongs to, and only that user's conversations.
3. A VIEWER can ask, but is never offered a write.

## Test data & environment

- The server runs with the mock LLM provider (no network; `setup.ts` blocks `fetch`).
- `integration.ai.test.ts` registers an owner, a viewer and a stranger, with a VND cash account at `500000` ([integration.ai:11](../../server/test/integration.ai.test.ts#L11)).
- Message-shape constraints are probed in [002_ai_messages.sql](../../db/tests/002_ai_messages.sql).

## Test cases

| ID | Story | Scenario | Type | Expected result | Automated by | Status |
|---|---|---|---|---|---|---|
| TC-AI-01 | AI-US-02 | "Spent 65k … from Cash", then confirm, then confirm again | Integration | Proposal `PENDING` with no money moved; confirm 200, `CONFIRMED`, transaction `65000.0000`, balance `435000.0000`; second confirm 409 `AI_ACTION_NOT_PENDING` | [integration.ai:41](../../server/test/integration.ai.test.ts#L41) | Covered |
| TC-AI-02 | AI-US-02 | Ambiguous account; currency not the account's | Integration | No action; the reply names the choice or the currency | [integration.ai:67](../../server/test/integration.ai.test.ts#L67) | Covered |
| TC-AI-03 | AI-US-02 | Dismiss, then confirm | Integration | Dismiss 200 `DISMISSED`; confirm 409 `AI_ACTION_NOT_PENDING` | [integration.ai:77](../../server/test/integration.ai.test.ts#L77) | Covered |
| TC-AI-04 | AI-US-02 | VIEWER asks to record a spend | Integration | 201 with `action: null` | [integration.ai:100](../../server/test/integration.ai.test.ts#L100) | Covered |
| TC-AI-05 | AI-US-02 | Spend request on an archived wallet; confirm after the caller's role was lowered to VIEWER | Integration | No proposal; confirm 403 with nothing recorded | [integration.assistant:33](../../server/test/integration.assistant.test.ts#L33), [integration.assistant:57](../../server/test/integration.assistant.test.ts#L57) | Covered |
| TC-AI-06 | AI-US-01 | Ask for a balance; page the history | Integration | The answer quotes the derived balance (`435,000 VND`); messages newest first, `hasMore` set | [integration.ai:87](../../server/test/integration.ai.test.ts#L87) | Covered |
| TC-AI-07 | AI-US-01 | Ask "how much did I spend" on a wallet with two currencies and a transfer | Integration | Per-currency figures, never summed; the transfer not counted as spending | [integration.assistant:79](../../server/test/integration.assistant.test.ts#L79) | Covered |
| TC-AI-08 | AI-US-01/03 | Stranger asks about the wallet, reads someone else's conversation, lists conversations | Integration | 404 `WALLET_NOT_FOUND`; 404 `AI_CONVERSATION_NOT_FOUND`; only their own conversations | [integration.ai:107](../../server/test/integration.ai.test.ts#L107) | Covered |
| TC-AI-09 | AI-US-03 | Delete a conversation | Integration | 200; its messages then 404 | [integration.ai:119](../../server/test/integration.ai.test.ts#L119), [integration.assistant:103](../../server/test/integration.assistant.test.ts#L103) | Covered |
| TC-AI-10 | AI-US-02 | Amount parsing: `65k`, grouped digits, no amount, zero, Vietnamese with or without diacritics | Unit | Exact amounts, never via a float; nothing when absent; never zero | [ai-mock-provider:13](../../server/test/ai-mock-provider.test.ts#L13), [:22](../../server/test/ai-mock-provider.test.ts#L22), [:27](../../server/test/ai-mock-provider.test.ts#L27) | Covered |
| TC-AI-11 | AI-US-02 | Message rows written directly | DB probe | Blank title, unknown role, empty content, an action on a user message, an action without payload, a confirmed action with no transaction, unknown action type: all rejected | [002_ai_messages:45](../../db/tests/002_ai_messages.sql#L45)–[:88](../../db/tests/002_ai_messages.sql#L88) | Covered |
| TC-AI-12 | AI-US-01 | Guest opens the assistant; signed-in user opens chat offline | Mobile unit / E2E | Guest told it needs an account and offered sign-in, the input shown but disabled; history readable offline, sending disabled | offline and view-only rule: [chatAvailability:7](../../mobile/src/features/chat/chatAvailability.test.ts#L7), [:11](../../mobile/src/features/chat/chatAvailability.test.ts#L11), [:15](../../mobile/src/features/chat/chatAvailability.test.ts#L15) | Partial — the guest prompt is rendering only (`AiChatScreen.tsx`) and needs E2E |
| TC-AI-13 | API §2.4 | AI routes without a bearer | Integration | 401 | [integration.auth:112](../../server/test/integration.auth.test.ts#L112) (every mounted route, AI included) | Covered |

## Gaps, by risk

1. **TC-AI-12**: the offline rule is now `features/chat/chatAvailability.ts` and unit-tested; the guest sign-in prompt is a plain render branch with no logic to extract, so only an E2E flow can prove it.
