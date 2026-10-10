---
description: Test, review if risky, commit, push, deploy and verify live
---
Ship the current changes:
1. Run `npm test`. Fix failures.
2. If the diff touches migrations, RLS, money, auth or deploy config, run the `judge` subagent on it; fix anything it rejects.
3. If a migration is included, apply it to Supabase first and confirm it landed.
4. Commit, push to main, wait for the Vercel status to be success.
5. Read the `prod-qa` results from the `qa-*` branches.
Report as Problem / Solution / Outcome, one line each, with pass counts.
