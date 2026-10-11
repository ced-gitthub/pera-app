# Pending migrations

SQL that is reviewed and tested but NOT yet applied to production. Move a file to `supabase/migrations/` only after it is applied (CLAUDE.md: apply to Supabase BEFORE merging code that needs it).

- `0009_row_limits.sql` - per-user row caps (50,000 transactions, 60 accounts, 150 categories, 100 recurring rules), raised as SQLSTATE `PRLIM`. Judge-approved; a dry run on production rolled back cleanly. The app already maps `PRLIM` to a clear message. To apply: paste the file into the Supabase SQL editor and run it, then move it to `supabase/migrations/`.
