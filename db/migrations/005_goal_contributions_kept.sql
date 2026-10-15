-- 005_goal_contributions_kept.sql
--
-- A goal contribution is never removed, by the API or by any other writer: no route deletes one,
-- the transaction recording it can't be deleted (§11.5), and this refuses the row's DELETE, a
-- cascade from its goal included.

BEGIN;

CREATE FUNCTION refuse_goal_contribution_delete() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'a goal contribution is never removed'
        USING ERRCODE = 'restrict_violation', CONSTRAINT = 'trg_goal_contribution_kept';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_goal_contribution_kept
    BEFORE DELETE ON goal_contributions
    FOR EACH ROW EXECUTE FUNCTION refuse_goal_contribution_delete();

COMMIT;
