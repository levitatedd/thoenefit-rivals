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
last_dump_msg=""
for attempt in $(seq 1 40); do
  sleep 3
  last_dump_msg=$(adb shell uiautomator dump /sdcard/ui.xml 2>&1 | tr -d '\r') || true
  adb exec-out cat /sdcard/ui.xml > "$OUT/ui.xml" 2>/dev/null || continue
  if grep -q 'Simulated data' "$OUT/ui.xml" && grep -q 'text="Today"' "$OUT/ui.xml"; then
    found=1
    echo "Dashboard visible after ~$((attempt * 3))s"
    break
  fi
done

adb exec-out screencap -p > "$OUT/android-today.png" || true
adb logcat -d > "$OUT/logcat.txt" || true

diagnose() {
  echo "::group::Diagnostics"
  echo "--- Last uiautomator dump result: ${last_dump_msg:-<none>}"
  echo "--- Focused window / resumed activity:"
  adb shell dumpsys window 2>/dev/null | grep -E "mCurrentFocus|mFocusedApp" | head -5 || true
  adb shell dumpsys activity activities 2>/dev/null | grep -E "ResumedActivity|topResumedActivity" | head -5 || true
  echo "--- App process running?"
  adb shell pidof "$PACKAGE" || echo "(not running)"
  echo "--- Visible text and accessibility labels (from ui.xml):"
  if [ -s "$OUT/ui.xml" ]; then
    grep -oE '(text|content-desc)="[^"]+"' "$OUT/ui.xml" | sort -u | head -60
  else
    echo "(ui.xml missing or empty)"
  fi
  echo "--- App crashes (FATAL EXCEPTION with stack):"
  grep -A 25 "FATAL EXCEPTION" "$OUT/logcat.txt" | head -80 || true
  echo "--- React Native JS errors/warnings:"
  grep -E "ReactNativeJS|ReactNative|Hermes" "$OUT/logcat.txt" | grep -viE "uiautomator" | head -60 || true
  echo "--- Not-responding / crash dialogs:"
  grep -iE "ANR in|isn't responding|has stopped|Process .* has died" "$OUT/logcat.txt" | head -20 || true
  echo "::endgroup::"
}

if [ "$found" -ne 1 ]; then
  echo "::error::The Today dashboard with the 'Simulated data' notice did not appear within 120s. Diagnostics below; screenshot, ui.xml and logcat are in the android-smoke-results artifact."
  diagnose
  exit 1
fi

if ! grep -qE 'content-desc="Steps: [0-9,]+ steps"' "$OUT/ui.xml"; then
  echo "::error::Dashboard rendered but the Steps metric is missing."
  diagnose
  exit 1
fi
if ! grep -qE 'content-desc="Active energy: [0-9,]+ kcal"' "$OUT/ui.xml"; then
  echo "::error::Dashboard rendered but the Active energy metric is missing."
  diagnose
  exit 1
fi

echo "✅ Android smoke test passed: app launched, simulated dashboard with steps and active energy is visible."
