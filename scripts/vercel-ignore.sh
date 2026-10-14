#!/bin/sh
# Vercel "Ignored Build Step": exit 0 = skip this build, exit 1 = build. (vercel.json caps the inline command at 256 characters, hence this file.)
# Production only builds when something that changes what the site serves changed since the LAST deployed commit (not just the parent commit,
# so a docs-only newest commit can never hide an earlier src change). Previews are not built (free-plan usage). Any doubt means build.
[ "$VERCEL_ENV" = "production" ] || exit 0
[ -n "$VERCEL_GIT_PREVIOUS_SHA" ] || exit 1
git cat-file -e "$VERCEL_GIT_PREVIOUS_SHA^{commit}" 2>/dev/null || exit 1
# shellcheck disable=SC2046
git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- $(cat scripts/deployable-paths)
