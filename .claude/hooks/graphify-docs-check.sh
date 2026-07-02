#!/bin/sh
# Claude Code SessionStart hook.
# If the git post-commit/post-checkout hook flagged doc/markdown changes that need
# LLM semantic re-extraction (which a git hook cannot do), surface an actionable
# reminder into the session so the knowledge graph + OuraVault get refreshed.
#
# Paired with the .oura_docs_pending flag written by graphify-post-change.sh.
REPO="/Users/noahmartz/Desktop/Oura/repo"
FLAG="$REPO/graphify-out/.oura_docs_pending"

[ -f "$FLAG" ] || exit 0

FILES=$(tr '\n' ' ' < "$FLAG" | sed 's/  */ /g' | sed 's/ *$//')

MSG="graphify: markdown/doc files changed since the last graph build and need semantic (LLM) re-extraction. A git hook has no LLM, so this was deferred to now. Changed docs: ${FILES}. To bring the knowledge graph and the OuraVault Obsidian vault fully up to date, do this proactively at session start: (1) run the graphify skill update flow '/graphify --update' — it re-extracts ONLY the changed docs via subagents, no API key needed since this session is the LLM; (2) run 'graphify export obsidian --dir ${REPO}/OuraVault' to refresh the vault notes; (3) run 'rm -f ${REPO}/graphify-out/.oura_docs_pending ${REPO}/graphify-out/needs_update' to clear the flags. If the user is clearly mid-task on something unrelated, mention the pending update briefly and offer to run it rather than interrupting."

# Resolve any python (only needed to JSON-escape the message safely).
PY=""
for c in "$REPO/graphify-out/.graphify_python" python3 python; do
    if [ "$c" = "$REPO/graphify-out/.graphify_python" ]; then
        [ -f "$c" ] && p=$(cat "$c" 2>/dev/null | tr -d '[:space:]') && [ -x "$p" ] && PY="$p" && break
    elif command -v "$c" >/dev/null 2>&1; then
        PY="$c"; break
    fi
done

if [ -n "$PY" ]; then
    "$PY" - "$MSG" <<'PYEOF'
import json, sys
print(json.dumps({"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": sys.argv[1]}}))
PYEOF
else
    echo "[graphify] Pending doc update: run /graphify --update then export the OuraVault vault." >&2
fi
exit 0
