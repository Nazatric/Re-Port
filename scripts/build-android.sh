#!/usr/bin/env bash
set +e
gradle :composeApp:assembleDebug --no-daemon --console=plain 2>&1 | tee build.log
result=${PIPESTATUS[0]}
if [ "$result" -ne 0 ]; then
  details=$(awk '/^e: / { print } /^\* What went wrong:/ { show=1 } /^\* Try:/ { show=0 } show { print }' build.log | head -c 3500)
  if [ -z "$details" ]; then details=$(tail -n 30 build.log | tail -c 3500); fi
  details=${details//'%'/'%25'}
  details=${details//$'\r'/'%0D'}
  details=${details//$'\n'/'%0A'}
  echo "::error title=Gradle build::$details"
fi
exit "$result"
