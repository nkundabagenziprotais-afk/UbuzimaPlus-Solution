#!/usr/bin/env bash
set -euo pipefail

ADMIN_WEB_ROOT="${ADMIN_WEB_ROOT:-}"
BACKUP_DIR="${BACKUP_DIR:-}"
CONFIRM_ROLLBACK="${CONFIRM_ROLLBACK:-}"

if [ "$CONFIRM_ROLLBACK" != "ROLLBACK_UBUZIMA_ADMIN" ]; then
  echo "Refusing rollback. Re-run with CONFIRM_ROLLBACK=ROLLBACK_UBUZIMA_ADMIN."
  exit 1
fi

if [ -z "$ADMIN_WEB_ROOT" ] || [ -z "$BACKUP_DIR" ]; then
  echo "Set ADMIN_WEB_ROOT and BACKUP_DIR."
  exit 1
fi

case "$ADMIN_WEB_ROOT" in
  */admin|*/admin/) ;;
  *)
    echo "ADMIN_WEB_ROOT must end with /admin."
    exit 1
    ;;
esac

if [ ! -d "$BACKUP_DIR" ]; then
  echo "Backup directory does not exist: $BACKUP_DIR"
  exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync is required for rollback."
  exit 1
fi

mkdir -p "$ADMIN_WEB_ROOT"

echo "== Restoring admin web root from backup =="
rsync -a --delete --exclude 'assets/***' "$BACKUP_DIR"/ "$ADMIN_WEB_ROOT"/

if [ -d "$BACKUP_DIR/assets" ]; then
  mkdir -p "$ADMIN_WEB_ROOT/assets"
  rsync -a "$BACKUP_DIR/assets"/ "$ADMIN_WEB_ROOT/assets"/
fi

echo "Rollback completed from: $BACKUP_DIR"
