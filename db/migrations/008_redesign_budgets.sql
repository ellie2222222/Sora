BEGIN;

-- 008_redesign_budgets.sql
-- Redesign budgets to support Yearly, Goal-based, and optional categories

-- 1. Make category_id optional
ALTER TABLE budgets ALTER COLUMN category_id DROP NOT NULL;

-- 2. Add goal_id for goal-based budgets
ALTER TABLE budgets ADD COLUMN goal_id UUID REFERENCES goals(id) ON DELETE CASCADE;

-- 3. Update the period_type constraint
ALTER TABLE budgets DROP CONSTRAINT chk_budget_period;
ALTER TABLE budgets ADD CONSTRAINT chk_budget_period 
    CHECK (period_type IN ('WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM', 'GOAL'));

-- 4. A budget must belong to a category, a goal, or be an overall wallet budget (both null)
-- (No strict constraint needed for that, both can be null)

-- 5. Drop the existing overlap constraint since budgets can now be non-category specific or goal-based
ALTER TABLE budgets DROP CONSTRAINT excl_budget_overlap;

-- 6. Add new overlap constraints
-- For category-specific budgets
ALTER TABLE budgets
    ADD CONSTRAINT excl_budget_category_overlap
    EXCLUDE USING GIST (
        category_id WITH =,
        daterange(start_date, end_date, '[]') WITH &&
    ) WHERE (status = 'ACTIVE' AND category_id IS NOT NULL);

-- For goal-specific budgets
ALTER TABLE budgets
    ADD CONSTRAINT excl_budget_goal_overlap
    EXCLUDE USING GIST (
        goal_id WITH =,
        daterange(start_date, end_date, '[]') WITH &&
    ) WHERE (status = 'ACTIVE' AND goal_id IS NOT NULL);

-- For overall wallet budgets (no category, no goal)
ALTER TABLE budgets
    ADD CONSTRAINT excl_budget_overall_overlap
    EXCLUDE USING GIST (
        wallet_id WITH =,
        daterange(start_date, end_date, '[]') WITH &&
    ) WHERE (status = 'ACTIVE' AND category_id IS NULL AND goal_id IS NULL);

COMMIT;
