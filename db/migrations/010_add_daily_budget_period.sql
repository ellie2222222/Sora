BEGIN;

-- 010_add_daily_budget_period.sql
-- Add DAILY to budget period types

ALTER TABLE budgets DROP CONSTRAINT chk_budget_period;
ALTER TABLE budgets ADD CONSTRAINT chk_budget_period 
    CHECK (period_type IN ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM', 'GOAL'));

COMMIT;
