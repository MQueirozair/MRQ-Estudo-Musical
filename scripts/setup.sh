#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== [1/3] Configurando ambiente Python (.venv) ==="
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt

echo "=== [2/3] Compilando núcleo C++17 DSP ==="
make -C core test

echo "=== [3/3] Instalando e compilando MRQ Studio (React + TS) ==="
npm --prefix apps/studio install
npm --prefix apps/studio run build

echo "=== Ambiente MRQ Estudo Musical pronto! Execute: make run ==="
