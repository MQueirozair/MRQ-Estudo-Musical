#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

make -C core test
npm --prefix apps/studio run build
.venv/bin/python -m pytest -v tests/
