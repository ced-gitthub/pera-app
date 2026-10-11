# Progress

## Fixed

- 2026-10-11 audit fixes (merged to main): undo no longer loses a trashed transaction; "last" resolves transfer + fee ties; transfers are saved once on double-tap; CSV accounts differing only in case merge and errors show; recurring start date limited to +/- 2 years; implausible dates refused; confirm before deleting accounts, categories and recurring rules; labels on placeholder-only inputs; global-error and not-found pages.
- 2026-10-11 prevention: `npm run selftest` (guard hook and tool names), `npm run verify` gate before any push to main (git pre-push hook), CI runs selftest + lint + format check, weekly health workflow, Dependabot, ESLint + Prettier, `.gitattributes` (LF everywhere), feature checklist and quality gates in CLAUDE.md. Fixed the guard hook and settings matcher that used `mcp__Supabase__` (the server is `supabase`), so the destructive-SQL guard now actually runs.

## Open bugs

- Lint ratchet: 286 warnings (258 `any`), all pre-existing. Do not let the number grow.
- `src/app/actions.ts` is about 1,170 lines. Split by topic (auth, transactions, accounts, imports). Note: a `'use server'` file may only export async functions, so split into several `'use server'` files and update imports.
- Home page reads up to 2,000 dates for the streak and runs `run_recurring` on every load; CSV export builds everything in memory; transaction search uses `ilike '%q%'`. Fine at today's size (busiest user 2,073 transactions), revisit if users grow.
- `.claude/settings.json` still allows Bash `git *`, `cat *`, `node *`, `python3 *`, which bypass the `Read(.env)` deny. Claude cannot tighten its own permissions; the owner must.
- No undo-skips-deleted-account test in `tests/prod` (the fake database cannot produce that error).
- Supabase dashboard: turn on leaked-password protection; keep "Confirm email" ON.

## Decisions

- Row caps are in `supabase/pending/0009_row_limits.sql`, not applied: the assistant's permission system blocked applying it to production. Apply by pasting into the Supabase SQL editor.
- Backups are NOT automated from GitHub Actions: this repo is public, and a database dump stored as an artifact would expose users' financial data.
- CAPTCHA (Cloudflare Turnstile) needs a Cloudflare account and a Supabase setting; not done.
- Staging: use Vercel preview deploys per branch; a second Supabase project (free tier allows two) is not created yet.

## Next steps

1. Apply `supabase/pending/0009_row_limits.sql` in the Supabase SQL editor, then move it to `supabase/migrations/`.
2. In GitHub: Settings -> Branches -> add a rule for `main` that requires the `ci` check to pass.
3. Split `actions.ts`; lower the lint warning limit as `any` is removed.
4. Optional: second Supabase project for staging; Turnstile CAPTCHA; scheduled database export to a private location.
