#!/bin/bash
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
python3 /Users/faharihamadasidi/.agents/skills/plane-archive/archive.py "$@"
