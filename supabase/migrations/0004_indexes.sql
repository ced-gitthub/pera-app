-- Applied to the live project via the Supabase connector (clears the 8 "unindexed foreign key" advisor notices).
create index if not exists tx_account_idx on public.transactions (account_id);
create index if not exists tx_transfer_account_idx on public.transactions (transfer_account_id) where transfer_account_id is not null;
create index if not exists tx_category_idx on public.transactions (category_id) where category_id is not null;
create index if not exists tx_recurring_idx on public.transactions (recurring_id) where recurring_id is not null;
create index if not exists budgets_category_idx on public.budgets (category_id, user_id);
create index if not exists rec_account_idx on public.recurring_transactions (account_id);
create index if not exists rec_category_idx on public.recurring_transactions (category_id);
create index if not exists rec_user_idx on public.recurring_transactions (user_id);
