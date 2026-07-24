#!/usr/bin/env bash
# Build VideoPicker.fda (requires zip, curl or wget)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADDON="$ROOT/addon"
DIST="$ROOT/dist"
YT_DIR="$ADDON/yt-dlp"
VERSION="${1:-2026.07.04}"
SKIP_FETCH="${SKIP_FETCH:-0}"

mkdir -p "$DIST"

if [[ "$SKIP_FETCH" != "1" ]]; then
  echo "Downloading yt-dlp $VERSION ..."
  # Avoid naming temp dirs yt-dlp-* — that pattern matches the extract root itself.
  TMP_ZIP="$(mktemp /tmp/vpicker-ytdlp-XXXXXX.zip)"
  TMP_DIR="$(mktemp -d /tmp/vpicker-ytdlp-XXXXXX)"
  URL="https://github.com/yt-dlp/yt-dlp/archive/refs/tags/${VERSION}.zip"
  if command -v curl >/dev/null; then
    curl -fsSL "$URL" -o "$TMP_ZIP"
  else
    wget -qO "$TMP_ZIP" "$URL"
  fi
  unzip -q "$TMP_ZIP" -d "$TMP_DIR"
  # Prefer the package dir directly; fall back to archive root (exclude TMP_DIR itself).
  PKG="$(find "$TMP_DIR" -mindepth 2 -maxdepth 3 -type d -name 'yt_dlp' | head -1)"
  if [[ -z "$PKG" || ! -f "$PKG/__main__.py" ]]; then
    echo "yt-dlp package not found in archive (version $VERSION)" >&2
    ls -la "$TMP_DIR" >&2 || true
    exit 1
  fi
  rm -rf "$YT_DIR"
  mkdir -p "$YT_DIR"
  cp -R "$PKG" "$YT_DIR/yt_dlp"
  echo "$VERSION" > "$YT_DIR/VERSION.txt"
  rm -rf "$TMP_ZIP" "$TMP_DIR"
fi

if [[ ! -f "$YT_DIR/yt_dlp/__main__.py" ]]; then
  echo "Missing addon/yt-dlp. Re-run without SKIP_FETCH=1" >&2
  exit 1
fi

FDA="$DIST/VideoPicker.fda"
rm -f "$FDA"
(
  cd "$ADDON"
  zip -qr "$FDA" . -x "*.pyc" -x "*__pycache__*"
)

echo "Built $FDA"
echo "Install in FDM: Add-ons → Install add-on from file → VideoPicker.fda"
