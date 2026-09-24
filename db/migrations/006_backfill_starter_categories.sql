-- 006_backfill_starter_categories.sql
--
-- Tops up every existing wallet with whichever starter categories it was
-- created without: seeding only runs when a wallet is created, and the starter
-- list (packages/contracts/src/starter-categories.ts) has grown since. A frozen
-- copy of that list, as of this migration.
--
-- A wallet already using a starter's name at the root — any type, archived
-- included — keeps its own: uq_category_name_per_parent rejects the duplicate
-- and DO NOTHING skips it, so a category the user archived is not re-added.
--

BEGIN;

INSERT INTO categories (wallet_id, name, type, icon, color)
SELECT wallets.id, starter.name, starter.type, starter.icon, starter.color
FROM wallets
CROSS JOIN (VALUES
    ('Food',                  'EXPENSE',  'utensils',        '#F97316'),
    ('Transportation',        'EXPENSE',  'bus',             '#0EA5E9'),
    ('Shopping',              'EXPENSE',  'shopping-bag',    '#A855F7'),
    ('Bills',                 'EXPENSE',  'receipt',         '#EF4444'),
    ('Housing',               'EXPENSE',  'home',            '#8B5CF6'),
    ('Groceries',             'EXPENSE',  'shopping-cart',   '#F59E0B'),
    ('Health',                'EXPENSE',  'heart-pulse',     '#F43F5E'),
    ('Entertainment',         'EXPENSE',  'film',            '#EC4899'),
    ('Education',             'EXPENSE',  'graduation-cap',  '#6366F1'),
    ('Travel',                'EXPENSE',  'plane',           '#14B8A6'),
    ('Subscriptions',         'EXPENSE',  'repeat',          '#8B5A2B'),
    ('Insurance',             'EXPENSE',  'shield',          '#475569'),
    ('Dining Out',            'EXPENSE',  'coffee',          '#D97706'),
    ('Utilities',             'EXPENSE',  'zap',             '#CA8A04'),
    ('Personal Care',         'EXPENSE',  'sparkles',        '#DB2777'),
    ('Fitness',               'EXPENSE',  'dumbbell',        '#0D9488'),
    ('Pets',                  'EXPENSE',  'paw-print',       '#B45309'),
    ('Repairs & Maintenance', 'EXPENSE',  'wrench',          '#57534E'),
    ('Movies',                'EXPENSE',  'clapperboard',    '#BE185D'),
    ('Snacks',                'EXPENSE',  'cookie',          '#C2410C'),
    ('Drinks',                'EXPENSE',  'cup-soda',        '#0891B2'),
    ('Fees',                  'EXPENSE',  'credit-card',     '#7C3AED'),
    ('Other Expense',         'EXPENSE',  'circle-ellipsis', '#64748B'),
    ('Salary',                'INCOME',   'banknote',        '#22C55E'),
    ('Freelance',             'INCOME',   'briefcase',       '#10B981'),
    ('Investment',            'INCOME',   'trending-up',     '#059669'),
    ('Gift',                  'INCOME',   'gift',            '#84CC16'),
    ('Rental Income',         'INCOME',   'building-2',      '#16A34A'),
    ('Interest',              'INCOME',   'percent',         '#15803D'),
    ('Bonus',                 'INCOME',   'award',           '#65A30D'),
    ('Refund',                'INCOME',   'undo-2',          '#4D7C0F'),
    ('Part Time',             'INCOME',   'clock',           '#0D9488'),
    ('Other Income',          'INCOME',   'hand-coins',      '#A16207'),
    ('Savings',               'TRANSFER', 'piggy-bank',      '#0EA5E9'),
    ('Debt Repayment',        'TRANSFER', 'handshake',       '#6366F1'),
    ('Credit Card Payment',   'TRANSFER', 'credit-card',     '#64748B'),
    ('Top Up',                'TRANSFER', 'wallet',          '#14B8A6'),
    ('Cash Withdrawal',       'TRANSFER', 'landmark',        '#78716C')
) AS starter (name, type, icon, color)
-- "Other Expense" replaced the old starter "Other"; a wallet that has "Other" already has its catch-all.
WHERE NOT (
    starter.name = 'Other Expense'
    AND EXISTS (
        SELECT 1 FROM categories existing
        WHERE existing.wallet_id = wallets.id
          AND existing.parent_id IS NULL
          AND LOWER(existing.name) = 'other'
    )
)
ON CONFLICT DO NOTHING;

COMMIT;
