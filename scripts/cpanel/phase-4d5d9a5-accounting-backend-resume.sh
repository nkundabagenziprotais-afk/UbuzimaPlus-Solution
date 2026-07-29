#!/usr/bin/env bash

set -u
set -o pipefail
export LC_ALL=C
export GIT_PAGER=cat
export PAGER=cat

WORKTREE="/home/inzoeqqx/development_worktrees/accounting-journal-approval-foundation-20260729"
SOURCE_COMMIT="d29def18354bb783ff77f686cd20885cf381870e"
SOURCE_PATH="scripts/cpanel/phase-4d5d9a5-accounting-backend.sh"
SOURCE_SHA="1ffcea1c80a91573f58aa65ac775311fe4cb30441fc794de0f9b6a0bed1991db"
LOCKED_BASE="ff1ea5f4cd66ddc7db37c10485208df817c58e71"

TMP_DIR="$(mktemp -d)"
ORIGINAL="$TMP_DIR/original.sh"
PATCHED="$TMP_DIR/patched.sh"
PYTHON_BIN="$(command -v python3 2>/dev/null || command -v python 2>/dev/null)"

cleanup() {
    result=$?
    trap - EXIT
    rm -rf "$TMP_DIR"
    exit "$result"
}

abort() {
    echo "reason=$1" >&2
    exit 1
}

trap cleanup EXIT

echo "============================================================"
echo "PHASE 4D5D9A5 COMMITTED-CHECKPOINT RESUME"
echo "============================================================"

[[ -e "$WORKTREE/.git" ]] || abort "development_worktree_missing"
[[ -n "$PYTHON_BIN" ]] || abort "python_missing"

CURRENT_HEAD="$(git -C "$WORKTREE" rev-parse HEAD 2>/dev/null)"

git -C "$WORKTREE" merge-base --is-ancestor "$LOCKED_BASE" "$CURRENT_HEAD" || \
    abort "current_head_not_descended_from_locked_accounting_base:$CURRENT_HEAD"

git -C "$WORKTREE" show "$SOURCE_COMMIT:$SOURCE_PATH" > "$ORIGINAL" || \
    abort "source_script_extraction_failed"

ACTUAL_SOURCE_SHA="$(sha256sum "$ORIGINAL" | awk '{print $1}')"
[[ "$ACTUAL_SOURCE_SHA" == "$SOURCE_SHA" ]] || \
    abort "source_script_checksum_failed:$ACTUAL_SOURCE_SHA"

"$PYTHON_BIN" - "$ORIGINAL" "$PATCHED" "$LOCKED_BASE" <<'PY'
from pathlib import Path
import sys

source_path = Path(sys.argv[1])
patched_path = Path(sys.argv[2])
locked_base = sys.argv[3]
source = source_path.read_text()

old_head = f'EXPECTED_HEAD="{locked_base}"'
new_head = (
    f'LOCKED_BASE_HEAD="{locked_base}"\n'
    'EXPECTED_HEAD="$(git -C "$WORKTREE" rev-parse HEAD 2>/dev/null)"'
)

if source.count(old_head) != 1:
    raise SystemExit('reason=head_assignment_patch_target_invalid')
source = source.replace(old_head, new_head, 1)

old_head_check = (
    '[[ "$CURRENT_HEAD" == "$EXPECTED_HEAD" ]] || '
    'abort "unexpected_development_head:$CURRENT_HEAD"'
)
new_head_check = (
    'git -C "$WORKTREE" merge-base --is-ancestor '
    '"$LOCKED_BASE_HEAD" "$CURRENT_HEAD" || '
    'abort "development_head_not_descended_from_locked_base:$CURRENT_HEAD"\n\n'
    + old_head_check
)

if source.count(old_head_check) != 1:
    raise SystemExit('reason=head_check_patch_target_invalid')
source = source.replace(old_head_check, new_head_check, 1)

old_checkpoint = '''ACTUAL_UNTRACKED="$PHASE_DIR/untracked-before.txt"
EXPECTED_UNTRACKED="$PHASE_DIR/expected-before.txt"

printf '%s\\n' "${EXPECTED_EXISTING[@]}" | sort > "$EXPECTED_UNTRACKED"
git -C "$WORKTREE" ls-files --others --exclude-standard | sort > "$ACTUAL_UNTRACKED"

cmp -s "$EXPECTED_UNTRACKED" "$ACTUAL_UNTRACKED" || {
    echo "--- expected checkpoint ---"
    cat "$EXPECTED_UNTRACKED"
    echo "--- actual checkpoint ---"
    cat "$ACTUAL_UNTRACKED"
    abort "ten_file_checkpoint_changed"
}'''

new_checkpoint = '''ACTUAL_UNTRACKED="$PHASE_DIR/untracked-before.txt"
EXPECTED_UNTRACKED="$PHASE_DIR/expected-before.txt"
UNEXPECTED_UNTRACKED="$PHASE_DIR/unexpected-untracked-before.txt"

printf '%s\\n' "${EXPECTED_EXISTING[@]}" | sort > "$EXPECTED_UNTRACKED"
git -C "$WORKTREE" ls-files --others --exclude-standard | sort > "$ACTUAL_UNTRACKED"
comm -13 "$EXPECTED_UNTRACKED" "$ACTUAL_UNTRACKED" > "$UNEXPECTED_UNTRACKED"

if [[ -s "$UNEXPECTED_UNTRACKED" ]]; then
    echo "--- unexpected untracked source ---"
    cat "$UNEXPECTED_UNTRACKED"
    abort "unexpected_untracked_source_present"
fi

for relative in "${EXPECTED_EXISTING[@]}"
do
    [[ -s "$WORKTREE/$relative" ]] || abort "checkpoint_file_missing:$relative"
done

echo "checkpoint_storage=TRACKED_OR_UNTRACKED_ACCEPTED"'''

if source.count(old_checkpoint) != 1:
    raise SystemExit('reason=checkpoint_patch_target_invalid')
source = source.replace(old_checkpoint, new_checkpoint, 1)

old_final = '''EXPECTED_CHANGED="$PHASE_DIR/expected-changed-files.txt"
printf '%s\\n' "${SOURCE_PATHS[@]}" | sort -u > "$EXPECTED_CHANGED"

cmp -s "$EXPECTED_CHANGED" "$CHANGED_FILES" || {
    echo "--- expected source changes ---"
    cat "$EXPECTED_CHANGED"
    echo "--- actual source changes ---"
    cat "$CHANGED_FILES"
    abort "final_source_changeset_mismatch"
}

[[ "$(wc -l < "$CHANGED_FILES" | tr -d ' ')" == "15" ]] || abort "unexpected_changed_file_count"'''

new_final = '''EXPECTED_CHANGED="$PHASE_DIR/expected-changed-files.txt"
MILESTONE_PATHS=(
    "${NEW_FILES[@]}"
    "$ROUTE_REL"
)
printf '%s\\n' "${MILESTONE_PATHS[@]}" | sort -u > "$EXPECTED_CHANGED"

cmp -s "$EXPECTED_CHANGED" "$CHANGED_FILES" || {
    echo "--- expected milestone source changes ---"
    cat "$EXPECTED_CHANGED"
    echo "--- actual milestone source changes ---"
    cat "$CHANGED_FILES"
    abort "final_source_changeset_mismatch"
}

[[ "$(wc -l < "$CHANGED_FILES" | tr -d ' ')" == "5" ]] || abort "unexpected_changed_file_count"'''

if source.count(old_final) != 1:
    raise SystemExit('reason=final_changeset_patch_target_invalid')
source = source.replace(old_final, new_final, 1)

old_report = '    echo "development_changed_files=15"'
new_report = (
    '    echo "development_changed_files=5"\n'
    '    echo "accounting_foundation_files=15"'
)

if source.count(old_report) != 1:
    raise SystemExit('reason=report_patch_target_invalid')
source = source.replace(old_report, new_report, 1)

patched_path.write_text(source)
print('resume_patch=APPLIED')
PY

PATCH_STATUS=$?
[[ "$PATCH_STATUS" == "0" ]] || exit "$PATCH_STATUS"

bash -n "$PATCHED" || abort "patched_script_syntax_failed"

chmod 700 "$PATCHED"

echo "current_development_head=$CURRENT_HEAD"
echo "locked_base_ancestry=VERIFIED"
echo "committed_checkpoint_support=ENABLED"
echo "patched_script_syntax=PASSED"
echo "implementation=STARTING"
echo

bash --noprofile --norc "$PATCHED"
STATUS=$?

echo
echo "resume_milestone_result=$STATUS"
exit "$STATUS"
