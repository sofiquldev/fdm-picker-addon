#!/usr/bin/env bash
# Native messaging host for Video Picker (macOS / Linux)
# Reads length-prefixed JSON from stdin, starts FDM with the URL.

set -euo pipefail

read_msg() {
  # 4-byte little-endian length + UTF-8 JSON
  local len_raw
  len_raw="$(dd bs=4 count=1 2>/dev/null | od -An -tu4 | tr -d ' ')"
  if [[ -z "${len_raw:-}" || "$len_raw" -eq 0 ]]; then
    exit 0
  fi
  dd bs="$len_raw" count=1 2>/dev/null
}

send_msg() {
  local json="$1"
  local len
  len="$(printf '%s' "$json" | wc -c | tr -d ' ')"
  printf "$(printf '\\x%02x\\x%02x\\x%02x\\x%02x' \
    $((len & 255)) $(((len >> 8) & 255)) $(((len >> 16) & 255)) $(((len >> 24) & 255)))"
  printf '%s' "$json"
}

find_fdm() {
  if [[ -n "${FDM_PATH:-}" && -x "$FDM_PATH" ]]; then
    echo "$FDM_PATH"
    return
  fi
  local c
  for c in \
    /usr/bin/fdm \
    /usr/local/bin/fdm \
    /opt/freedownloadmanager/fdm \
    "$HOME/.local/bin/fdm" \
    /Applications/Free\ Download\ Manager.app/Contents/MacOS/fdm
  do
    if [[ -x "$c" ]]; then
      echo "$c"
      return
    fi
  done
  command -v fdm 2>/dev/null || true
}

MSG="$(read_msg || true)"
if [[ -z "${MSG:-}" ]]; then
  exit 0
fi

# Minimal JSON parse without jq (action + url)
ACTION="$(printf '%s' "$MSG" | sed -n 's/.*"action"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
URL="$(printf '%s' "$MSG" | sed -n 's/.*"url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
[[ -z "$ACTION" ]] && ACTION="download"

if [[ "$ACTION" == "ping" ]]; then
  FDM="$(find_fdm)"
  send_msg "{\"ok\":true,\"host\":\"org.fdm.videopicker\",\"fdm\":\"${FDM}\"}"
  exit 0
fi

if [[ "$ACTION" == "download" || "$ACTION" == "add" ]]; then
  if [[ -z "$URL" ]]; then
    send_msg '{"ok":false,"error":"Missing url"}'
    exit 0
  fi
  FDM="$(find_fdm)"
  if [[ -z "$FDM" ]]; then
    send_msg '{"ok":false,"error":"Free Download Manager not found. Set FDM_PATH."}'
    exit 0
  fi
  "$FDM" "$URL" >/dev/null 2>&1 &
  send_msg "{\"ok\":true,\"fdm\":\"${FDM}\",\"url\":\"${URL}\"}"
  exit 0
fi

send_msg "{\"ok\":false,\"error\":\"Unknown action: ${ACTION}\"}"
