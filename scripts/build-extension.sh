#!/usr/bin/env bash
# Pack the browser extension as a zip
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXT="$ROOT/extension"
DIST="$ROOT/dist"
OUT="$DIST/videopicker-extension.zip"

mkdir -p "$DIST"
rm -f "$OUT"
(
  cd "$EXT"
  zip -qr "$OUT" .
)

echo "Built $OUT"
echo "Load unpacked from extension/ or unpack the zip for distribution."
