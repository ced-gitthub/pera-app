#!/bin/sh
# SessionStart: one short block of context so the session does not spend turns rediscovering state. Fails silently.
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0
echo "Pera state:"
echo "- branch $(git branch --show-current 2>/dev/null), HEAD $(git rev-parse --short HEAD 2>/dev/null), $(git status --porcelain 2>/dev/null | wc -l | tr -d ' ') uncommitted file(s)"
echo "- latest migration: $(ls supabase/migrations 2>/dev/null | tail -1)"
if command -v gh >/dev/null 2>&1; then
  timeout 12 gh run list --branch main --limit 3 --json name,conclusion,status,headSha --jq '.[]|"- run \(.name) \(.headSha[0:7]): \(.conclusion // .status)"' 2>/dev/null
fi
exit 0
