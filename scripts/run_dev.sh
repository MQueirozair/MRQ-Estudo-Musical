#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "Iniciando MRQ Estudo Musical em http://0.0.0.0:${MRQ_PORT:-8765}"
exec .venv/bin/python -m backend.main
