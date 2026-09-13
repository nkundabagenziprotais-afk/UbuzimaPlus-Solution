#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="$(
    cd "$(dirname "$0")/.." &&
    pwd
)"

cd "$PROJECT_ROOT"

command -v flutter >/dev/null 2>&1 || {
    echo "Flutter SDK is required."
    exit 1
}

flutter create \
    --org com.ubuzimaplus \
    --project-name ubuzima_native \
    --platforms android,ios \
    .

echo
echo "IMPORTANT:"
echo "Before production signing:"
echo "Android applicationId must be com.ubuzimaplus.app"
echo "iOS bundle identifier must be com.ubuzimaplus.app"
echo "Android must use the existing Ubuzima+ signing identity."
echo
echo "BOOTSTRAP=PASS"
