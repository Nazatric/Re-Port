#!/usr/bin/env bash
# Runs each Maestro flow on the booted emulator, with its own retry. Called as one line from android.yml,
# because the android-emulator-runner action runs each line of its `script` in a separate shell.
# The emulator and the Maestro driver are occasionally unstable, so a flow that fails gets one fresh attempt.
set -uo pipefail
export PATH="$HOME/.maestro/bin:$PATH"

adb install -r apk/app-debug.apk || exit 1

mkdir -p maestro-out
: > maestro-report.xml
overall=0
for flow in maestro/*.yaml; do
  name=$(basename "$flow" .yaml)
  status=1
  attempt=0
  for attempt in 1 2; do
    timeout --kill-after=30 420 maestro test "$flow" --format junit \
      --output "maestro-out/junit-$name-$attempt.xml" --test-output-dir "maestro-out/$name-$attempt"
    status=$?
    [ "$status" -eq 0 ] && break
    echo "Flow $name failed on attempt $attempt."
    adb shell input keyevent KEYCODE_HOME || true
    sleep 10
  done
  [ "$status" -ne 0 ] && overall=1
  # The report the annotations read: the final attempt of every flow.
  [ -f "maestro-out/junit-$name-$attempt.xml" ] && cat "maestro-out/junit-$name-$attempt.xml" >> maestro-report.xml
done

if [ "$overall" -ne 0 ]; then
  # The failing step as an annotation on the run page, then the screen hierarchy and device log for the report.
  maestro hierarchy > maestro-out/hierarchy-at-failure.txt 2>&1 || true
  node scripts/maestro-annotate.mjs 2>&1 | tee maestro-out/annotations.txt || true
  adb logcat -d -t 400 > maestro-out/logcat-tail.txt 2>&1 || true
  adb logcat -d -b crash > maestro-out/crash-buffer.txt 2>&1 || true
  echo "::group::Device log (last 400 lines)"
  tail -400 maestro-out/logcat-tail.txt
  echo "::endgroup::"
fi
exit "$overall"
