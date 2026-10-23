#!/usr/bin/env bash
set -e

REF_URL="${1:-https://raylight.app}"
LOCAL_URL="${2:-http://localhost:3000}"
OUT_DIR="/tmp/parity-audit"

mkdir -p "$OUT_DIR"
echo "Capturing reference snapshot from $REF_URL..."
npx agent-browser --session ref open "$REF_URL"
npx agent-browser --session ref snapshot -i --json > "$OUT_DIR/ref-tree.json"
npx agent-browser --session ref screenshot "$OUT_DIR/ref-screen.png"

echo "Capturing local snapshot from $LOCAL_URL..."
npx agent-browser --session local open "$LOCAL_URL"
npx agent-browser --session local snapshot -i --json > "$OUT_DIR/local-tree.json"
npx agent-browser --session local screenshot "$OUT_DIR/local-screen.png"

echo "Snapshots saved to $OUT_DIR"