#!/usr/bin/env bash
#
# Post-deploy smoke test: verify the LIVE markshelf deployment actually serves
# the baked docs and that its git-backed APIs work. Run by the deploy workflow
# after `flyctl deploy`, but also usable locally:
#
#   scripts/smoke-test.sh https://markshelf-demo.fly.dev
#
set -euo pipefail

BASE="${1:?usage: smoke-test.sh <base-url>}"
BASE="${BASE%/}"   # strip trailing slash
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail() { echo "❌ $1"; exit 1; }

# Common curl options: retry through cold starts / brief 5xx while the machine boots.
CURL=(curl -sS --retry 8 --retry-all-errors --retry-delay 5 --max-time 30)

echo "→ Smoke testing $BASE"

# 1. Home page renders (HTTP 200 + app shell)
code="$("${CURL[@]}" -o "$TMP/home.html" -w '%{http_code}' "$BASE/")"
[ "$code" = "200" ] || fail "home page returned HTTP $code"
grep -qi "markshelf" "$TMP/home.html" || fail "home page missing 'markshelf' marker"
echo "  ✓ home page (200)"

# 2. Tree API returns the baked docs (confirms docs/ was actually bundled)
"${CURL[@]}" -o "$TMP/tree.json" "$BASE/api/tree"
grep -q '要求定義' "$TMP/tree.json" || fail "/api/tree missing expected docs content (要求定義)"
echo "  ✓ /api/tree serves docs"

# 3. Timeline API returns at least one entry (confirms .git history was baked
#    and git safe.directory is configured — otherwise this is silently empty)
"${CURL[@]}" -o "$TMP/timeline.json" "$BASE/api/timeline"
grep -q '"hash"' "$TMP/timeline.json" || fail "/api/timeline has no entries — git history not available in the image"
echo "  ✓ /api/timeline reflects git history"

echo "✅ Smoke test passed"
