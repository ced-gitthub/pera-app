#!/bin/sh
# Stop hook: if code or tests changed, the unit tests must pass before the session can finish.
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0
git diff --name-only HEAD 2>/dev/null | grep -Eq '^(src|tests)/' || exit 0
out=$(npm test --silent 2>&1) && exit 0
echo "Unit tests are failing; fix them before finishing:" >&2
echo "$out" | tail -25 >&2
exit 2
