#!/usr/bin/env bash

set -Eeuo pipefail
set +H
umask 022

REPO_ROOT="$(
    cd "$(
        dirname "${BASH_SOURCE[0]}"
    )/../.." &&
    pwd
)"

PUBLIC_ROOT="${PUBLIC_ROOT:-/home/inzoeqqx/ubuzimaplus.com/public_html}"

FOUNDATION_NAME="approved-ui-14c217722a29dcd3"
EXPECTED_RUNTIME_HASH="14c217722a29dcd3108d7a4172acbede130c4aaa8fd7032aee48dc2635ac81e9"

ARTIFACT_DIR="$REPO_ROOT/deployment/runtime-foundations/admin/$FOUNDATION_NAME"
ARCHIVE="$ARTIFACT_DIR/admin-runtime.tar.gz"

LIVE_ADMIN="$PUBLIC_ROOT/admin"

ID="$(date -u '+%Y%m%dT%H%M%SZ')"

STAGE="$PUBLIC_ROOT/.approved-admin-stage-$ID"
PREVIOUS="$PUBLIC_ROOT/.admin-before-foundation-restore-$ID"

SWAPPED=0

fail() {
    echo "reason=$1" >&2
    exit 1
}

tree_hash() {
    local directory="$1"

    (
        cd "$directory"

        find . -type f -print0 |
        LC_ALL=C sort -z |
        xargs -0 sha256sum |
        sha256sum |
        awk '{print $1}'
    )
}

rollback() {
    if [[ "$SWAPPED" == "1" &&
          -d "$PREVIOUS" ]]
    then
        rm -rf "$LIVE_ADMIN"

        mv \
            "$PREVIOUS" \
            "$LIVE_ADMIN"

        echo "automatic_rollback=COMPLETE"
    fi
}

cleanup() {
    status=$?
    trap - EXIT

    if [[ "$status" != "0" ]]
    then
        rollback
        rm -rf "$STAGE" 2>/dev/null || true

        echo "approved_admin_restore=INCOMPLETE"
        echo "child_result=$status"
    fi

    exit "$status"
}

trap cleanup EXIT

[[ -f "$ARCHIVE" ]] ||
    fail "approved_runtime_archive_missing"

(
    cd "$ARTIFACT_DIR"
    sha256sum -c SHA256SUMS
)

[[ ! -e "$STAGE" ]] ||
    fail "stage_path_exists"

[[ ! -e "$PREVIOUS" ]] ||
    fail "previous_path_exists"

mkdir -p "$STAGE"

tar -xzf \
    "$ARCHIVE" \
    -C "$STAGE"

[[ -d "$STAGE/admin" ]] ||
    fail "staged_admin_missing"

STAGED_HASH="$(
    tree_hash "$STAGE/admin"
)"

[[ "$STAGED_HASH" == "$EXPECTED_RUNTIME_HASH" ]] ||
    fail "staged_runtime_hash_mismatch:$STAGED_HASH"

mv \
    "$LIVE_ADMIN" \
    "$PREVIOUS"

SWAPPED=1

mv \
    "$STAGE/admin" \
    "$LIVE_ADMIN"

rm -rf "$STAGE"

LIVE_HASH="$(
    tree_hash "$LIVE_ADMIN"
)"

[[ "$LIVE_HASH" == "$EXPECTED_RUNTIME_HASH" ]] ||
    fail "live_runtime_hash_mismatch:$LIVE_HASH"

ADMIN_HTTP="$(
    curl -sSL \
        -o /dev/null \
        -w '%{http_code}' \
        --max-time 30 \
        "https://ubuzimaplus.com/admin/?foundation_restore=$ID"
)"

[[ "$ADMIN_HTTP" == "200" ]] ||
    fail "admin_health_failed:$ADMIN_HTTP"

SWAPPED=0

echo "approved_admin_restore=COMPLETE"
echo "approved_runtime_hash=$LIVE_HASH"
echo "admin_http=$ADMIN_HTTP"
echo "previous_runtime=$PREVIOUS"
echo "child_result=0"
