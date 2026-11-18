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

APP_LABEL="ThoeneFit Rivals"

adb wait-for-device
# Software-rendered CI emulators are slow right after boot, and system apps (e.g. Pixel
# Launcher) can raise "isn't responding" dialogs that cover our app. Let the system settle
# and suppress system error dialogs; any that still appear are handled in the loop below.
adb shell settings put global hide_error_dialogs 1 >/dev/null 2>&1 || true
sleep 20
adb install -r "$APK"
adb logcat -c
adb shell monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1

# Taps a button in the current UI dump by its exact text. Returns non-zero if not found.
tap_button() {
  local bounds
  bounds=$(grep -oE "text=\"$1\"[^>]*bounds=\"\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]\"" "$OUT/ui.xml" | head -1 \
    | grep -oE '\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]') || return 1
  read -r x1 y1 x2 y2 <<< "$(echo "$bounds" | sed -E 's/\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\]/\1 \2 \3 \4/')"
  adb shell input tap $(((x1 + x2) / 2)) $(((y1 + y2) / 2))
}

found=0
last_dump_msg=""
system_dialogs=0
for attempt in $(seq 1 40); do
  sleep 3
  last_dump_msg=$(adb shell uiautomator dump /sdcard/ui.xml 2>&1 | tr -d '\r') || true
  adb exec-out cat /sdcard/ui.xml > "$OUT/ui.xml" 2>/dev/null || continue
  if grep -qE "isn.t responding|keeps stopping|has stopped" "$OUT/ui.xml"; then
    dialog=$(grep -oE 'text="[^"]*(isn.t responding|keeps stopping|has stopped)[^"]*"' "$OUT/ui.xml" | head -1)
    if echo "$dialog" | grep -q "$APP_LABEL"; then
      echo "::error::Our app raised a system error dialog: $dialog"
      break
    fi
    system_dialogs=$((system_dialogs + 1))
    echo "Dismissing unrelated system dialog ($dialog)"
    tap_button "Wait" || adb shell input keyevent KEYCODE_BACK
    continue
  fi
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
if [ "$system_dialogs" -gt 0 ]; then
  echo "::notice::Dismissed $system_dialogs unrelated system 'isn't responding' dialog(s) from the emulator (not this app)."
fi
