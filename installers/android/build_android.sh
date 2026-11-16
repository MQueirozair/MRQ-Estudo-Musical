#!/usr/bin/env bash
# Android APK + AAB Release Build Script (Requires JDK 17 + Android SDK/NDK)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

echo "=== [1/3] Compilando UI Responsiva Mobile/Tablet ==="
npm --prefix apps/studio ci
npm --prefix apps/studio run build

echo "=== [2/3] Copiando Assets Web para Android ==="
mkdir -p apps/android/android/app/src/main/assets/public
rm -rf apps/android/android/app/src/main/assets/public/*
cp -r apps/studio/dist/* apps/android/android/app/src/main/assets/public/

echo "=== [3/3] Compilando C++17 NDK (JNI) + APK & AAB via Gradle ==="
cd apps/android/android
gradle assembleRelease bundleRelease

echo "=== Artefatos Android gerados ==="
find app/build/outputs -type f \( -name "*.apk" -o -name "*.aab" \) -ls
