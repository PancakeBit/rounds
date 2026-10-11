#!/usr/bin/env bash
# Builds a release APK and signs it with the Rounds release key.
# Requires: ROUNDS_KS_PASS env var (keystore password), JDK 17, ~/Android/Sdk.
set -euo pipefail
cd "$(dirname "$0")/.."

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export JAVA_HOME="${ROUNDS_JAVA_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
KEYSTORE="${ROUNDS_KEYSTORE:-$HOME/.android/rounds-release.jks}"
APKSIGNER="$ANDROID_HOME/build-tools/36.0.0/apksigner"

[ -f "$KEYSTORE" ] || { echo "Missing keystore: $KEYSTORE"; exit 1; }
[ -n "${ROUNDS_KS_PASS:-}" ] || { echo "Set ROUNDS_KS_PASS to the keystore password"; exit 1; }

npx expo prebuild -p android --clean
(cd android && ./gradlew assembleRelease)

mkdir -p dist
"$APKSIGNER" sign --ks "$KEYSTORE" --ks-key-alias rounds --ks-pass env:ROUNDS_KS_PASS \
  --out dist/rounds.apk android/app/build/outputs/apk/release/app-release.apk
"$APKSIGNER" verify dist/rounds.apk
echo "Built dist/rounds.apk"
