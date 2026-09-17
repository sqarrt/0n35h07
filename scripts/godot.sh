#!/usr/bin/env bash
# Wrapper around the pinned Godot 4.x headless-capable binary: $GODOT_BIN (CI), else the one installed in WSL.
# Usage: scripts/godot.sh <godot args>
set -euo pipefail
exec "${GODOT_BIN:-$HOME/.local/share/godot/godot}" "$@"
