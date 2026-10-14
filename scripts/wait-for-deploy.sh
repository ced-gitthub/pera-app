#!/bin/sh
# prod-qa: wait until production serves code that includes the newest DEPLOYABLE commit of this push. Vercel skips commits that change nothing
# deployable (scripts/vercel-ignore.sh) and, for a push of several commits, builds only the newest, so /api/health may report a commit that is
# newer than the last deployable one. Accept any production commit between "newest deployable commit" and the pushed HEAD. Never test stale code.
git fetch --unshallow -q 2>/dev/null || true
# shellcheck disable=SC2046
want=$(git log -1 --format=%H -- $(cat scripts/deployable-paths))
got=
for i in $(seq 1 50); do
  got=$(curl -s "$BASE_URL/api/health" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).commit)}catch{console.log('?')}})")
  full=$(git rev-parse -q --verify "${got}^{commit}" 2>/dev/null) || full=
  echo "prod commit=$got want>=${want%"${want#???????}"}"
  if [ -n "$full" ] && git merge-base --is-ancestor "$want" "$full" && git merge-base --is-ancestor "$full" "$GITHUB_SHA"; then exit 0; fi
  sleep 15
done
echo "::error title=prod-qa::production never served a commit containing $want (last seen $got); not testing stale code"
exit 1
