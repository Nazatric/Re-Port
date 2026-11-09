#!/usr/bin/env bash
set +e
gradle :composeApp:assembleDebug --no-daemon --console=plain 2>&1 | tee build.log
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
chunks, chunk = [], ''
for line in errors:
    if len(chunk) + len(line) > 3000:
        chunks.append(chunk)
        chunk = ''
    chunk += line + '\n'
if chunk:
    chunks.append(chunk)
for chunk in chunks[:9]:
    escaped = chunk.replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
    print(f'::error title=Gradle build::{escaped}')
PY
fi
exit "$result"
