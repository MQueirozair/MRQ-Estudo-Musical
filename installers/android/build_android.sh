#!/usr/bin/env bash
# Android APK + AAB Release Build Script (Requires JDK 17 + Android SDK/NDK + Gradle 8.9+)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

LOG_FILE="/tmp/mrq_android_build.log"
: > "$LOG_FILE"

on_error() {
  echo "::error::Android build failed — tail of log:"
  tail -n 35 "$LOG_FILE" | while IFS= read -r line; do
    echo "::error::$line"
  done
}
trap on_error ERR

echo "=== [1/4] Compilando UI Responsiva Mobile/Tablet ==="
npm --prefix apps/studio ci 2>&1 | tee -a "$LOG_FILE"
npm --prefix apps/studio run build 2>&1 | tee -a "$LOG_FILE"

echo "=== [2/4] Copiando Assets Web para Android ==="
ASSETS_DIR="apps/android/android/app/src/main/assets"
mkdir -p "$ASSETS_DIR"
rm -rf "${ASSETS_DIR:?}/"*
cp -r apps/studio/dist/* "$ASSETS_DIR/"

if [ -n "${ANDROID_HOME:-}" ]; then
  printf 'sdk.dir=%s\n' "$ANDROID_HOME" > apps/android/android/local.properties
fi

echo "=== [3/4] Configurando Assinatura de Release (Test Keystore se não fornecida) ==="
if [ -z "${ANDROID_KEYSTORE_PATH:-}" ]; then
  TEST_KS="/tmp/mrq-android-test-release.jks"
  rm -f "$TEST_KS"
  keytool -genkeypair \
    -keystore "$TEST_KS" \
    -storepass "mrqEstudo2026" \
    -keypass "mrqEstudo2026" \
    -alias "mrq-release" \
    -keyalg RSA -keysize 2048 -validity 3650 \
    -dname "CN=MRQ Estudo Musical, OU=Engineering, O=MRQ Audio, L=Sao Paulo, ST=SP, C=BR" 2>&1 | tee -a "$LOG_FILE"
  export ANDROID_KEYSTORE_PATH="$TEST_KS"
  export ANDROID_KEYSTORE_PASSWORD="mrqEstudo2026"
  export ANDROID_KEY_ALIAS="mrq-release"
  export ANDROID_KEY_PASSWORD="mrqEstudo2026"
fi

echo "=== [4/4] Compilando C++17 NDK (JNI) + APK & AAB Assinados via Gradle ==="
cd apps/android/android
gradle --version 2>&1 | tee -a "$LOG_FILE"
gradle assembleRelease bundleRelease --no-daemon --stacktrace 2>&1 | tee -a "$LOG_FILE"

mkdir -p "$REPO_ROOT/apps/android/release"
cp app/build/outputs/apk/release/app-release.apk "$REPO_ROOT/apps/android/release/MRQ-Estudo-Musical-1.0.0-android.apk"
cp app/build/outputs/bundle/release/app-release.aab "$REPO_ROOT/apps/android/release/MRQ-Estudo-Musical-1.0.0-android.aab"

echo "=== Artefatos Android gerados em apps/android/release/ ==="
ls -lh "$REPO_ROOT/apps/android/release/"
