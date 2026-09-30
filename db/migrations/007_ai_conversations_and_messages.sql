-- 007_ai_conversations_and_messages.sql
--
-- The AI assistant's chat history. A conversation belongs to one user and is
-- read in the context of one wallet at a time. An assistant message may carry
-- a proposed action (a transaction draft), which only the user's explicit
-- confirmation turns into a real transaction; the ledger is never written by
-- the assistant itself.
--

BEGIN;

CREATE TABLE IF NOT EXISTS ai_conversations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id   UUID REFERENCES wallets(id),
    title       VARCHAR(150) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_ai_conversation_title CHECK (length(btrim(title)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user
    ON ai_conversations (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_messages (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id        UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role                   VARCHAR(20) NOT NULL,
    content                TEXT NOT NULL,
    action_type            VARCHAR(40),
    action_payload         JSONB,
    action_status          VARCHAR(20),
    action_transaction_id  UUID REFERENCES transactions(id),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_ai_message_role
        CHECK (role IN ('USER', 'ASSISTANT')),
    CONSTRAINT chk_ai_message_content CHECK (length(content) BETWEEN 1 AND 8000),
    CONSTRAINT chk_ai_message_action_type
        CHECK (action_type IN ('CREATE_TRANSACTION')),
    CONSTRAINT chk_ai_message_action_status
        CHECK (action_status IN ('PENDING', 'CONFIRMED', 'DISMISSED')),
    -- An action is all-or-nothing, only the assistant proposes one, and a
    -- confirmed action names the transaction it recorded (and nothing else does).
    CONSTRAINT chk_ai_message_action_shape CHECK (
        (action_type IS NULL) = (action_payload IS NULL)
        AND (action_type IS NULL) = (action_status IS NULL)
        AND (action_type IS NULL OR role = 'ASSISTANT')
        AND (COALESCE(action_status, '') = 'CONFIRMED') = (action_transaction_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation
    ON ai_messages (conversation_id, created_at, id);

COMMIT;
