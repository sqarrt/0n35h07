#!/usr/bin/env bash
# Wrapper around the pinned Godot 4.x headless-capable binary (installed in WSL).
# Usage: scripts/godot.sh <godot args>
set -euo pipefail
exec "$HOME/.local/share/godot/godot" "$@"
