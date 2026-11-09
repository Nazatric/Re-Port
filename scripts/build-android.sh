#!/usr/bin/env bash
set +e
gradle :composeApp:assembleDebug --no-daemon --console=plain 2>&1 | tee build.log
result=${PIPESTATUS[0]}
if [ "$result" -ne 0 ]; then
  details=$(tail -n 120 build.log | tail -c 16000)
  details=${details//'%'/'%25'}
  details=${details//$'\r'/'%0D'}
  details=${details//$'\n'/'%0A'}
  echo "::error title=Gradle build::$details"
fi
exit "$result"
