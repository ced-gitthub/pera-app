PASS [RLS + constraints + aggregates (real Supabase)] signup trigger seeded defaults (6 accounts, 20 categories: 6 income + 14 expense)
PASS [RLS + constraints + aggregates (real Supabase)] insert the spec dataset (9 rows)
PASS [RLS + constraints + aggregates (real Supabase)] period_summary: income 3,450,000 / expenses 1,075,000 / net 2,375,000 minor units
PASS [RLS + constraints + aggregates (real Supabase)] account_balances: BPI 3,250,000 / GCash -450,000 / Cash -425,000; total 2,375,000
PASS [RLS + constraints + aggregates (real Supabase)] account_spending + monthly_summary(2020) + sum_expense
PASS [RLS + constraints + aggregates (real Supabase)] transfer GCash->Cash 2,000: moves balances, total unchanged, not income/expense
PASS [RLS + constraints + aggregates (real Supabase)] constraint: amount 0 rejected
PASS [RLS + constraints + aggregates (real Supabase)] constraint: amount -5 rejected
PASS [RLS + constraints + aggregates (real Supabase)] constraint: amount 1000000000000 rejected
PASS [RLS + constraints + aggregates (real Supabase)] constraint: transfer to same account rejected
PASS [RLS + constraints + aggregates (real Supabase)] constraint: expense without category rejected
PASS [RLS + constraints + aggregates (real Supabase)] constraint: description over 120 chars rejected
PASS [RLS + constraints + aggregates (real Supabase)] constraint: duplicate account name rejected; account in use cannot be deleted
PASS [RLS + constraints + aggregates (real Supabase)] idempotency: same request submitted 3x => exactly 2 rows
PASS [RLS + constraints + aggregates (real Supabase)] dedupe: import_hash and external_id upserts insert once
PASS [RLS + constraints + aggregates (real Supabase)] budgets: insert ok, duplicate (category,month,year) rejected, negative rejected
PASS [RLS + constraints + aggregates (real Supabase)] recurring monthly from Jan 31: Jan31, Feb28, Mar31, Apr30; re-run adds nothing
PASS [RLS + constraints + aggregates (real Supabase)] recurring weekly every 2 weeks (to end_date) and yearly from Feb 29
PASS [RLS + constraints + aggregates (real Supabase)] RLS: user B cannot read user A's transactions
PASS [RLS + constraints + aggregates (real Supabase)] RLS: user B cannot read user A's accounts
PASS [RLS + constraints + aggregates (real Supabase)] RLS: user B cannot read user A's categories
PASS [RLS + constraints + aggregates (real Supabase)] RLS: user B cannot read user A's budgets
PASS [RLS + constraints + aggregates (real Supabase)] RLS: user B cannot read user A's recurring_transactions
PASS [RLS + constraints + aggregates (real Supabase)] RLS: B's unfiltered reads return only B's own rows
PASS [RLS + constraints + aggregates (real Supabase)] RLS: B cannot UPDATE A's transaction (and A's row is unchanged)
PASS [RLS + constraints + aggregates (real Supabase)] RLS: B cannot DELETE A's transaction (and it still exists)
PASS [RLS + constraints + aggregates (real Supabase)] RLS: B cannot INSERT rows owned by A (tx, account, category, budget, recurring)
PASS [RLS + constraints + aggregates (real Supabase)] ownership: B cannot link B's rows to A's account/category (composite FKs)
PASS [RLS + constraints + aggregates (real Supabase)] RLS: B's aggregate functions never include A's data
PASS [RLS + constraints + aggregates (real Supabase)] RLS: B cannot read or change A's profile; A can edit own
PASS [RLS + constraints + aggregates (real Supabase)] user_settings: A saves own layout; B cannot read, change or insert A's row; anonymous sees nothing
PASS [RLS + constraints + aggregates (real Supabase)] user_settings: B has a separate row; unfiltered reads return only B's own
PASS [RLS + constraints + aggregates (real Supabase)] user_settings: layout must be a JSON object under 20 KB
PASS [RLS + constraints + aggregates (real Supabase)] new users: Savings is flagged "counts as savings", the rest are not; all show on Home; manual order is set
PASS [RLS + constraints + aggregates (real Supabase)] new users: categories are ordered with "Other" and "Other Income" last
PASS [RLS + constraints + aggregates (real Supabase)] account short names: unique per user ignoring case, 1-12 characters, can be cleared
PASS [RLS + constraints + aggregates (real Supabase)] no_account_summary: works for a signed-in user (one row), blocked for anonymous
PASS [RLS + constraints + aggregates (real Supabase)] anonymous (no login) cannot read transactions
PASS [RLS + constraints + aggregates (real Supabase)] anonymous (no login) cannot read accounts
PASS [RLS + constraints + aggregates (real Supabase)] anonymous (no login) cannot read categories
PASS [RLS + constraints + aggregates (real Supabase)] anonymous (no login) cannot read budgets
PASS [RLS + constraints + aggregates (real Supabase)] anonymous (no login) cannot read recurring_transactions
PASS [RLS + constraints + aggregates (real Supabase)] anonymous (no login) cannot read profiles
PASS [RLS + constraints + aggregates (real Supabase)] anonymous cannot insert or call aggregate functions with data
PASS [RLS + constraints + aggregates (real Supabase)] after sign-out the same client can no longer read
PASS [RLS + constraints + aggregates (real Supabase)] cleanup: test rows removed