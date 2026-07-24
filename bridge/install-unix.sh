#!/usr/bin/env bash
# Register Video Picker native messaging host (macOS + Linux)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST_PS1="$ROOT/bridge/host.ps1"
HOST_SH="$ROOT/bridge/host.sh"
EXT_ID_FILE="$ROOT/bridge/EXTENSION_ID.txt"
EXT_ID="${1:-}"

if [[ -z "$EXT_ID" && -f "$EXT_ID_FILE" ]]; then
  EXT_ID="$(tr -d '[:space:]' < "$EXT_ID_FILE")"
fi

if [[ -z "$EXT_ID" ]]; then
  EXT_ID="cecbjfflmkdkpejjjbmpmlppgbpgmanm"
fi

# Prefer the shell host on Unix
if [[ ! -f "$HOST_SH" ]]; then
  echo "Missing bridge/host.sh" >&2
  exit 1
fi
chmod +x "$HOST_SH"

write_manifest() {
  local dir="$1"
  local kind="$2" # chrome | firefox
  mkdir -p "$dir"
  local out="$dir/org.fdm.videopicker.json"
  if [[ "$kind" == "firefox" ]]; then
    cat > "$out" <<EOF
{
  "name": "org.fdm.videopicker",
  "description": "Video Picker for FDM",
  "path": "$HOST_SH",
  "type": "stdio",
  "allowed_extensions": ["videopicker@fdm.local"]
}
EOF
  else
    cat > "$out" <<EOF
{
  "name": "org.fdm.videopicker",
  "description": "Video Picker for FDM",
  "path": "$HOST_SH",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://${EXT_ID}/"]
}
EOF
  fi
  echo "Wrote $out"
}

OS="$(uname -s)"
if [[ "$OS" == "Darwin" ]]; then
  write_manifest "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts" chrome
  write_manifest "$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts" chrome
  write_manifest "$HOME/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts" chrome
  write_manifest "$HOME/Library/Application Support/Mozilla/NativeMessagingHosts" firefox
else
  write_manifest "$HOME/.config/google-chrome/NativeMessagingHosts" chrome
  write_manifest "$HOME/.config/chromium/NativeMessagingHosts" chrome
  write_manifest "$HOME/.config/microsoft-edge/NativeMessagingHosts" chrome
  write_manifest "$HOME/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts" chrome
  write_manifest "$HOME/.mozilla/native-messaging-hosts" firefox
fi

echo ""
echo "Bridge installed for extension ID: $EXT_ID"
echo "Restart your browser, then try Download from Video Picker."
echo "If FDM is not found, export FDM_PATH=/path/to/fdm"
