#!/bin/sh
# Idempotent installer for the Oura repo's graphify auto-sync git hooks.
#
# The git repository root here is $HOME (the project has no .git of its own), and
# git hooks are NOT version-controlled — so after a fresh clone / new machine /
# wiped hooks dir, run THIS script (which IS committed) to recreate the customized
# post-commit + post-checkout hooks. Safe to run repeatedly; it replaces only its
# own marked block and leaves any other hook content intact.
#
#   sh .claude/hooks/install-graphify-hooks.sh          # install / repair
#   sh .claude/hooks/install-graphify-hooks.sh status   # report only
#
# It does NOT build the graph. If graphify-out/graph.json is missing, build it once
# in Claude Code with:  /graphify . --obsidian --obsidian-dir <repo>/OuraVault

set -u
REPO="/Users/noahmartz/Desktop/Oura/repo"
HELPER="$REPO/.claude/hooks/graphify-post-change.sh"
ACTION="${1:-install}"

# Resolve a python (used only for safe hook-file splicing below).
PY=""
for c in python3 python; do command -v "$c" >/dev/null 2>&1 && PY="$c" && break; done
[ -z "$PY" ] && { echo "ERROR: python3 not found"; exit 1; }

# Resolve the real hooks dir. --absolute-git-dir yields the .git dir as an
# absolute path (here $HOME/.git since the repo has no .git of its own).
GIT_DIR_ABS=$(git -C "$REPO" rev-parse --absolute-git-dir 2>/dev/null)
[ -z "$GIT_DIR_ABS" ] && { echo "ERROR: not a git repo at $REPO"; exit 1; }
# Honor core.hooksPath if set, else <gitdir>/hooks.
HP=$(git -C "$REPO" config --get core.hooksPath 2>/dev/null || true)
if [ -n "$HP" ]; then
    case "$HP" in /*) HOOKS_DIR="$HP" ;; *) HOOKS_DIR="$(git -C "$REPO" rev-parse --show-toplevel)/$HP" ;; esac
else
    HOOKS_DIR="$GIT_DIR_ABS/hooks"
fi

if [ "$ACTION" = "status" ]; then
    for h in post-commit post-checkout; do
        if [ -f "$HOOKS_DIR/$h" ] && grep -q "graphify" "$HOOKS_DIR/$h" 2>/dev/null; then
            echo "$h: installed ($HOOKS_DIR/$h)"
        else
            echo "$h: NOT installed"
        fi
    done
    [ -f "$REPO/graphify-out/graph.json" ] && echo "graph.json: present" || echo "graph.json: MISSING (build with /graphify . --obsidian --obsidian-dir $REPO/OuraVault)"
    exit 0
fi

mkdir -p "$HOOKS_DIR"
chmod +x "$HELPER" "$REPO/.claude/hooks/graphify-docs-check.sh" 2>/dev/null || true
# Ensure the scan-root marker exists (helper + graphify update rely on it).
mkdir -p "$REPO/graphify-out"
printf '%s' "$REPO" > "$REPO/graphify-out/.graphify_root"

# Splice a marked block into a hook file via python (create if absent, replace our
# own block if present, preserve any other content).
_install_hook() {
    _name="$1"; _start="$2"; _end="$3"; _body="$4"
    HOOK_PATH="$HOOKS_DIR/$_name" HK_START="$_start" HK_END="$_end" HK_BODY="$_body" \
    "$PY" - <<'PYEOF'
import os, re, pathlib
p = pathlib.Path(os.environ["HOOK_PATH"])
start, end, body = os.environ["HK_START"], os.environ["HK_END"], os.environ["HK_BODY"]
block = f"{start}\n{body}\n{end}\n"
if p.exists():
    txt = p.read_text()
    if start in txt and end in txt:
        txt = re.sub(re.escape(start) + r".*?" + re.escape(end) + r"\n?", "", txt, flags=re.DOTALL)
    txt = txt.rstrip()
    if not txt or txt in ("#!/bin/sh", "#!/bin/bash"):
        out = "#!/bin/sh\n" + block
    else:
        out = txt + "\n\n" + block
else:
    out = "#!/bin/sh\n" + block
p.write_text(out)
p.chmod(0o755)
print("installed", p)
PYEOF
}

COMMIT_BODY='[ "${GRAPHIFY_SKIP_HOOK:-0}" = "1" ] && exit 0
GIT_DIR=${GIT_DIR:-$(git rev-parse --git-dir 2>/dev/null)}
[ -d "$GIT_DIR/rebase-merge" ] && exit 0
[ -d "$GIT_DIR/rebase-apply" ] && exit 0
[ -f "$GIT_DIR/MERGE_HEAD" ] && exit 0
[ -f "$GIT_DIR/CHERRY_PICK_HEAD" ] && exit 0
HELPER="'"$HELPER"'"
LOG="${HOME}/.cache/graphify-rebuild.log"
[ -x "$HELPER" ] || exit 0
mkdir -p "$(dirname "$LOG")"
echo "[graphify oura] post-commit fired; launching background update (log: $LOG)"
( sh "$HELPER" commit >> "$LOG" 2>&1 ) >/dev/null 2>&1 &'

CHECKOUT_BODY='[ "${GRAPHIFY_SKIP_HOOK:-0}" = "1" ] && exit 0
PREV_HEAD=$1; NEW_HEAD=$2; BRANCH_SWITCH=$3
[ "$BRANCH_SWITCH" != "1" ] && exit 0
GIT_DIR=${GIT_DIR:-$(git rev-parse --git-dir 2>/dev/null)}
[ -d "$GIT_DIR/rebase-merge" ] && exit 0
[ -d "$GIT_DIR/rebase-apply" ] && exit 0
[ -f "$GIT_DIR/MERGE_HEAD" ] && exit 0
[ -f "$GIT_DIR/CHERRY_PICK_HEAD" ] && exit 0
HELPER="'"$HELPER"'"
LOG="${HOME}/.cache/graphify-rebuild.log"
[ -x "$HELPER" ] || exit 0
mkdir -p "$(dirname "$LOG")"
echo "[graphify oura] branch switch; launching background update (log: $LOG)"
( sh "$HELPER" checkout "$PREV_HEAD" "$NEW_HEAD" >> "$LOG" 2>&1 ) >/dev/null 2>&1 &'

_install_hook post-commit   "# graphify-hook-start"          "# graphify-hook-end"          "$COMMIT_BODY"
_install_hook post-checkout "# graphify-checkout-hook-start" "# graphify-checkout-hook-end" "$CHECKOUT_BODY"

echo "graphify hooks installed in $HOOKS_DIR"
[ -f "$REPO/graphify-out/graph.json" ] || echo "NOTE: graphify-out/graph.json missing — build once with /graphify . --obsidian --obsidian-dir $REPO/OuraVault"
