#!/bin/bash
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
python3 "$SCRIPT_DIR/archive.py" "$@"
