#!/usr/bin/env bash
# Installs the release APK on the running emulator, launches it, and checks that the
# simulated-data dashboard renders. Used by .github/workflows/android-smoke.yml.
set -euo pipefail

# Set by the workflow's "Keep the APK" step.
APK="${APK_PATH:?APK_PATH not set}"
PACKAGE="${APP_PACKAGE:?APP_PACKAGE not set}"
OUT="smoke-output"
mkdir -p "$OUT"
echo "APK: $APK"
echo "Package: $PACKAGE"

adb wait-for-device
adb install -r "$APK"
adb logcat -c
adb shell monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1

found=0
for attempt in $(seq 1 40); do
  sleep 3
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || continue
  adb exec-out cat /sdcard/ui.xml > "$OUT/ui.xml" 2>/dev/null || continue
  if grep -q 'Simulated data' "$OUT/ui.xml" && grep -q 'text="Today"' "$OUT/ui.xml"; then
    found=1
    echo "Dashboard visible after ~$((attempt * 3))s"
    break
  fi
done

adb exec-out screencap -p > "$OUT/android-today.png" || true
adb logcat -d > "$OUT/logcat.txt" || true

if [ "$found" -ne 1 ]; then
  echo "::error::The Today dashboard with the 'Simulated data' notice did not appear within 120s. See smoke-output/ (screenshot, ui.xml, logcat)."
  grep -E "FATAL EXCEPTION|ReactNativeJS|AndroidRuntime" "$OUT/logcat.txt" | tail -40 || true
  exit 1
fi

if ! grep -qE 'content-desc="Steps: [0-9,]+ steps"' "$OUT/ui.xml"; then
  echo "::error::Dashboard rendered but the Steps metric is missing."
  exit 1
fi
if ! grep -qE 'content-desc="Active energy: [0-9,]+ kcal"' "$OUT/ui.xml"; then
  echo "::error::Dashboard rendered but the Active energy metric is missing."
  exit 1
fi

echo "✅ Android smoke test passed: app launched, simulated dashboard with steps and active energy is visible."
