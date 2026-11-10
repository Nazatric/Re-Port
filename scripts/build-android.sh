#!/usr/bin/env bash
set +e
./gradlew assembleDebug --no-daemon --console=plain 2>&1 | tee build.log
result=${PIPESTATUS[0]}
if [ "$result" -ne 0 ]; then
  python3 - <<'PY'
from pathlib import Path
lines = Path('build.log').read_text(errors='replace').splitlines()
errors = [line for line in lines if line.startswith('e: ')]
if not errors:
    try:
        start = lines.index('* What went wrong:')
        end = lines.index('* Try:', start)
        errors = lines[start:end]
    except ValueError:
        errors = lines[-30:]
text = '\n'.join(errors)[:3000].replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
print(f'::error title=Gradle build::{text}')
PY
fi
exit "$result"
