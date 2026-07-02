#!/bin/sh
# Shared graphify auto-update logic for the Oura repo, invoked (backgrounded) by
# the git post-commit and post-checkout hooks in ~/.git/hooks/.
#
# Why a helper: the git root here is $HOME (not the project), so the stock
# `graphify hook install` logic resolves graphify-out/ against the wrong dir.
# This script pins everything to the Oura repo and does what the stock hook does
# not: (1) INCREMENTAL code re-extraction that preserves the semantic doc nodes
# (via _rebuild_code(changed_paths=...)), (2) re-export of the OuraVault Obsidian
# vault, (3) a durable flag for deferred (LLM) doc re-extraction.
#
# Usage:
#   graphify-post-change.sh commit
#   graphify-post-change.sh checkout <prev_head> <new_head>
#
# Runs SYNCHRONOUSLY (the caller backgrounds it) so it can also be tested directly.

set -u
MODE="${1:-commit}"

GRAPHIFY_REPO="/Users/noahmartz/Desktop/Oura/repo"
GRAPHIFY_VAULT="$GRAPHIFY_REPO/OuraVault"
GRAPHIFY_OUT="$GRAPHIFY_REPO/graphify-out"
export PYTHONHASHSEED=0

# --- Resolve a Python that has graphify, WITHOUT trusting a single hard-coded
# path (survives interpreter upgrades / reinstalls). Order: the interpreter
# graphify itself recorded, then a couple of well-known locations, then PATH.
GRAPHIFY_PY=""
_try_py() { [ -n "$1" ] && "$1" -c "import graphify" >/dev/null 2>&1 && GRAPHIFY_PY="$1"; }
if [ -z "$GRAPHIFY_PY" ] && [ -f "$GRAPHIFY_OUT/.graphify_python" ]; then
    _p=$(cat "$GRAPHIFY_OUT/.graphify_python" 2>/dev/null | tr -d '[:space:]')
    [ -x "$_p" ] && _try_py "$_p"
fi
[ -z "$GRAPHIFY_PY" ] && _try_py "/Library/Frameworks/Python.framework/Versions/3.10/bin/python3"
if [ -z "$GRAPHIFY_PY" ]; then
    _b=$(command -v graphify 2>/dev/null)
    [ -n "$_b" ] && _sb=$(head -1 "$_b" 2>/dev/null | sed 's/^#![[:space:]]*//') && _try_py "$_sb"
fi
[ -z "$GRAPHIFY_PY" ] && command -v python3 >/dev/null 2>&1 && _try_py "python3"
[ -z "$GRAPHIFY_PY" ] && command -v python  >/dev/null 2>&1 && _try_py "python"
if [ -z "$GRAPHIFY_PY" ]; then
    echo "[graphify oura] no Python with graphify found; skipping (run 'graphify hook install' env or pip install graphifyy)"
    exit 0
fi
# graphify entrypoint: prefer the console script, fall back to `python -m graphify`.
gfy() {
    _g=$(command -v graphify 2>/dev/null)
    if [ -n "$_g" ]; then "$_g" "$@"; else "$GRAPHIFY_PY" -m graphify "$@"; fi
}

# Only act once the graph has been built for this repo.
[ -f "$GRAPHIFY_OUT/graph.json" ] || exit 0

# Compute the set of changed files under the repo (paths relative to the repo),
# excluding generated dirs so the hook never chases its own output.
case "$MODE" in
    checkout)
        PREV="${2:-}"; NEW="${3:-}"
        [ -n "$PREV" ] && [ -n "$NEW" ] || exit 0
        CHANGED=$(git -C "$GRAPHIFY_REPO" diff --name-only --relative "$PREV" "$NEW" 2>/dev/null)
        ;;
    *)
        CHANGED=$(git -C "$GRAPHIFY_REPO" diff --name-only --relative HEAD~1 HEAD 2>/dev/null \
                  || git -C "$GRAPHIFY_REPO" diff --name-only --relative HEAD 2>/dev/null)
        ;;
esac
CHANGED=$(printf '%s\n' "$CHANGED" | grep -vE '^(graphify-out/|OuraVault/)' | grep -v '^$' || true)
[ -z "$CHANGED" ] && exit 0

CODE_CHANGED=$(printf '%s\n' "$CHANGED" | grep -iE '\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|rb|swift|kt|kts|c|cc|cpp|cxx|h|hpp|cs|scala|php|lua)$' || true)
DOC_CHANGED=$(printf '%s\n' "$CHANGED"  | grep -iE '\.(md|mdx|markdown|txt|rst|pdf)$' || true)
[ -z "$CODE_CHANGED" ] && [ -z "$DOC_CHANGED" ] && exit 0

cd "$GRAPHIFY_REPO" || exit 0
echo "[graphify oura] ===== $MODE $(date) ====="

if [ -n "$CODE_CHANGED" ]; then
    echo "[graphify oura] code changed -> incremental AST merge (no LLM):"
    printf '    %s\n' $CODE_CHANGED
    # Absolute paths for _rebuild_code; it preserves unchanged nodes (incl. the
    # semantic doc/concept nodes) and only re-extracts the files listed.
    CODE_ABS=$(printf '%s\n' "$CODE_CHANGED" | while IFS= read -r r; do [ -n "$r" ] && printf '%s\n' "$GRAPHIFY_REPO/$r"; done)
    GRAPHIFY_CHANGED="$CODE_ABS" GRAPHIFY_REPO="$GRAPHIFY_REPO" "$GRAPHIFY_PY" -c '
import os, sys
from pathlib import Path
changed = [Path(p) for p in os.environ.get("GRAPHIFY_CHANGED", "").splitlines() if p.strip()]
if not changed:
    sys.exit(0)
from graphify.watch import _rebuild_code, _apply_resource_limits
_apply_resource_limits()
ok = _rebuild_code(Path(os.environ["GRAPHIFY_REPO"]), changed_paths=changed)
print("[graphify oura] incremental _rebuild_code ok:", ok)
'
    echo "[graphify oura] re-exporting Obsidian vault -> $GRAPHIFY_VAULT"
    gfy export obsidian --dir "$GRAPHIFY_VAULT"
    echo "[graphify oura] code rebuild + vault export complete"
fi

if [ -n "$DOC_CHANGED" ]; then
    # Semantic doc extraction needs an LLM, which a git hook has none of.
    # Persist a durable flag the Claude Code SessionStart hook reads next session.
    # Dedicated flag (.oura_docs_pending) is NOT auto-cleared by code rebuilds.
    printf '%s\n' "$DOC_CHANGED" > "$GRAPHIFY_OUT/.oura_docs_pending"
    echo "1" > "$GRAPHIFY_OUT/needs_update"
    echo "[graphify oura] doc/markdown changed -> flagged for next-session /graphify --update:"
    printf '    %s\n' $DOC_CHANGED
fi

echo "[graphify oura] done."
