#!/usr/bin/env bash
# Runs the Maestro flows on the booted emulator. Called as one line from android.yml, because the
# android-emulator-runner action runs each line of its `script` in a separate shell.
set -uo pipefail
export PATH="$HOME/.maestro/bin:$PATH"

adb install -r apk/app-debug.apk || exit 1

# One retry: an emulator that stalls on the launcher during the first launch is not a product failure.
maestro test maestro/ --format junit --output maestro-report.xml --test-output-dir maestro-out
status=$?
if [ "$status" -ne 0 ]; then
  echo "Maestro failed once; retrying after the device settles."
  adb shell input keyevent KEYCODE_HOME || true
  sleep 15
  maestro test maestro/ --format junit --output maestro-report.xml --test-output-dir maestro-out
  status=$?
fi

if [ "$status" -ne 0 ]; then
  # The failing step as an annotation on the run page, then the screen hierarchy and device log for the report.
  mkdir -p maestro-out
  maestro hierarchy > maestro-out/hierarchy-at-failure.txt 2>&1 || true
  node scripts/maestro-annotate.mjs || true
  adb logcat -d -t 400 > maestro-out/logcat-tail.txt 2>&1 || true
  adb logcat -d -b crash > maestro-out/crash-buffer.txt 2>&1 || true
  echo "::group::Device log (last 400 lines)"
  tail -400 maestro-out/logcat-tail.txt
  echo "::endgroup::"
fi
exit "$status"
