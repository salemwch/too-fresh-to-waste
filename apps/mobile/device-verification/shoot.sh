#!/usr/bin/env bash
# Capture a labelled screenshot from the BlueStacks emulator.
#
#   ./shoot.sh <name>
#
# Writes shots/<name>.png. Deliberately dumb: the caller sets up the device
# state (theme, locale, density) so that the state is visible in the transcript
# rather than hidden inside this script.
set -euo pipefail

ADB="${LOCALAPPDATA}/Android/Sdk/platform-tools/adb.exe"
DEV="-s 127.0.0.1:5555"
DIR="$(cd "$(dirname "$0")" && pwd)"

name="${1:?usage: shoot.sh <name>}"
mkdir -p "$DIR/shots"

"$ADB" $DEV exec-out screencap -p > "$DIR/shots/${name}.png"
printf '%s  %s bytes\n' "${name}.png" "$(wc -c < "$DIR/shots/${name}.png")"
