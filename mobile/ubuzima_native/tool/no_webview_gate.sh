#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(
    cd "$(dirname "$0")/.." &&
    pwd
)"

fail_gate() {
    echo "NO_WEBVIEW_CONTRACT=FAIL"
    exit 1
}

PACKAGE_COUNT="$(
    {
        grep -RniE \
            'webview_flutter|flutter_inappwebview' \
            "$ROOT_DIR/lib" \
            "$ROOT_DIR/pubspec.yaml" \
            2>/dev/null ||
        true
    } |
    wc -l |
    tr -d ' '
)"

IMPORT_COUNT="$(
    {
        grep -RniE \
            "import[[:space:]]+['\"]package:(webview_flutter|flutter_inappwebview)" \
            "$ROOT_DIR/lib" \
            2>/dev/null ||
        true
    } |
    wc -l |
    tr -d ' '
)"

CLASS_COUNT="$(
    {
        grep -RniE \
            '\b(WebViewWidget|WebViewController|InAppWebView|InAppWebViewController|WKWebView|AndroidWebView)\b' \
            "$ROOT_DIR/lib" \
            2>/dev/null ||
        true
    } |
    wc -l |
    tr -d ' '
)"

LEGACY_COUNT="$(
    {
        grep -RniE \
            'ubuzima-plus-mobile-3-1-0|admin-preview-cursor|ubuzima_shell=pwa|ubuzima_native=capacitor' \
            "$ROOT_DIR/lib" \
            "$ROOT_DIR/pubspec.yaml" \
            2>/dev/null ||
        true
    } |
    wc -l |
    tr -d ' '
)"

echo "WEBVIEW_PACKAGE_COUNT=$PACKAGE_COUNT"
echo "WEBVIEW_IMPORT_COUNT=$IMPORT_COUNT"
echo "WEBVIEW_CLASS_COUNT=$CLASS_COUNT"
echo "LEGACY_WEB_RUNTIME_COUNT=$LEGACY_COUNT"

[ "$PACKAGE_COUNT" = "0" ] ||
    fail_gate

[ "$IMPORT_COUNT" = "0" ] ||
    fail_gate

[ "$CLASS_COUNT" = "0" ] ||
    fail_gate

[ "$LEGACY_COUNT" = "0" ] ||
    fail_gate

echo "NO_WEBVIEW_CONTRACT=PASS"
