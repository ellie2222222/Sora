BEGIN;

-- 011_budget_kind_and_transaction_goal.sql
-- A budget is exactly one kind (API spec §12.2), and only an expense carries a goal tag (§11.2).
-- The API is not the only writer, so both shapes are held here as well as in the service.
-- NOT VALID keeps the ACCESS EXCLUSIVE lock brief; 012 checks existing rows under a weaker lock.

-- Category budget: category set, no goal, any period but GOAL.
-- Goal budget: goal set, no category, period GOAL.
-- Wallet-wide budget: neither, any period but GOAL.
ALTER TABLE budgets
    ADD CONSTRAINT chk_budget_kind
    CHECK (
        (category_id IS NULL OR goal_id IS NULL)
        AND ((period_type = 'GOAL') = (goal_id IS NOT NULL))
    ) NOT VALID;

ALTER TABLE transactions
    ADD CONSTRAINT chk_transaction_goal
    CHECK (goal_id IS NULL OR type = 'EXPENSE') NOT VALID;

COMMIT;
