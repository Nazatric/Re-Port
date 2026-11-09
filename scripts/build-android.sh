#!/usr/bin/env bash
set +e
gradle :composeApp:assembleDebug --no-daemon --stacktrace 2>&1 | tee build.log
result=${PIPESTATUS[0]}
if [ "$result" -ne 0 ]; then
  grep -E '(^e: |^\* (Where|What went wrong)|^> |^Caused by:|^Execution failed|^Build file|^Script |^  Line |^FAILURE:)' build.log | head -50 | while IFS= read -r line; do
    echo "::error title=Gradle build::$line"
  done
fi
exit "$result"
