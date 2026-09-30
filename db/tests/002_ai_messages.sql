-- 002_ai_messages.sql
--
-- Proves the AI chat tables reject a malformed message or action: an unknown
-- role, an action the user authored, a half-written action, and a confirmed
-- action with no transaction behind it.
--
--   psql -d <db> -v ON_ERROR_STOP=1 -f db/tests/002_ai_messages.sql
--
-- Rolls back, like 001, so its fixed-id seed never persists.

\set ON_ERROR_STOP on
SET client_min_messages = NOTICE;

BEGIN;

CREATE OR REPLACE FUNCTION expect_reject(stmt TEXT, label TEXT) RETURNS void AS $$
BEGIN
    BEGIN
        EXECUTE stmt;
    EXCEPTION
        WHEN others THEN
            RAISE NOTICE 'PASS  reject  %', label;
            RETURN;
    END;
    RAISE EXCEPTION 'FAIL  % was ACCEPTED but must be rejected', label;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION expect_accept(stmt TEXT, label TEXT) RETURNS void AS $$
BEGIN
    EXECUTE stmt;
    RAISE NOTICE 'PASS  accept  %', label;
EXCEPTION
    WHEN others THEN
        RAISE EXCEPTION 'FAIL  % was REJECTED (%) but must be accepted', label, SQLERRM;
END;
$$ LANGUAGE plpgsql;

INSERT INTO users (id, email, password_hash, display_name, base_currency) VALUES
    ('71111111-1111-1111-1111-111111111111', 'ai-probe@example.invalid', 'x', 'Probe', 'VND');

INSERT INTO ai_conversations (id, user_id, title) VALUES
    ('7c000001-0000-0000-0000-000000000001', '71111111-1111-1111-1111-111111111111', 'Probe chat');

SELECT expect_reject($$
    INSERT INTO ai_conversations (user_id, title)
    VALUES ('71111111-1111-1111-1111-111111111111', '   ')
$$, 'ai_conversations: blank title');

SELECT expect_accept($$
    INSERT INTO ai_messages (conversation_id, role, content)
    VALUES ('7c000001-0000-0000-0000-000000000001', 'USER', 'Spent 50k on lunch')
$$, 'ai_messages: plain user message');

SELECT expect_reject($$
    INSERT INTO ai_messages (conversation_id, role, content)
    VALUES ('7c000001-0000-0000-0000-000000000001', 'SYSTEM', 'x')
$$, 'ai_messages: unknown role');

SELECT expect_reject($$
    INSERT INTO ai_messages (conversation_id, role, content)
    VALUES ('7c000001-0000-0000-0000-000000000001', 'USER', '')
$$, 'ai_messages: empty content');

SELECT expect_accept($$
    INSERT INTO ai_messages (conversation_id, role, content, action_type, action_payload, action_status)
    VALUES ('7c000001-0000-0000-0000-000000000001', 'ASSISTANT', 'Draft ready',
            'CREATE_TRANSACTION', '{}'::jsonb, 'PENDING')
$$, 'ai_messages: assistant proposes a pending action');

SELECT expect_reject($$
    INSERT INTO ai_messages (conversation_id, role, content, action_type, action_payload, action_status)
    VALUES ('7c000001-0000-0000-0000-000000000001', 'USER', 'x',
            'CREATE_TRANSACTION', '{}'::jsonb, 'PENDING')
$$, 'ai_messages: a user message cannot carry an action');

SELECT expect_reject($$
    INSERT INTO ai_messages (conversation_id, role, content, action_type, action_status)
    VALUES ('7c000001-0000-0000-0000-000000000001', 'ASSISTANT', 'x', 'CREATE_TRANSACTION', 'PENDING')
$$, 'ai_messages: an action without its payload');

SELECT expect_reject($$
    INSERT INTO ai_messages (conversation_id, role, content, action_type, action_payload, action_status)
    VALUES ('7c000001-0000-0000-0000-000000000001', 'ASSISTANT', 'x',
            'CREATE_TRANSACTION', '{}'::jsonb, 'CONFIRMED')
$$, 'ai_messages: a confirmed action must name its transaction');

SELECT expect_reject($$
    INSERT INTO ai_messages (conversation_id, role, content, action_type, action_payload, action_status)
    VALUES ('7c000001-0000-0000-0000-000000000001', 'ASSISTANT', 'x',
            'DELETE_EVERYTHING', '{}'::jsonb, 'PENDING')
$$, 'ai_messages: unknown action type');

DELETE FROM ai_conversations WHERE id = '7c000001-0000-0000-0000-000000000001';
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM ai_messages WHERE conversation_id = '7c000001-0000-0000-0000-000000000001') THEN
        RAISE EXCEPTION 'FAIL  deleting a conversation left its messages behind';
    END IF;
    RAISE NOTICE 'PASS  cascade  ai_conversations delete removes its messages';
END;
$$;

ROLLBACK;

\echo ''
\echo 'All AI chat probes passed.'
