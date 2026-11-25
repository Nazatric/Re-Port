#!/usr/bin/env bash
# Copies the Maestro logs of this run into ci-logs/maestro-<run id>/ and commits them to the branch.
# Runs only in the android-e2e job, which has contents: write. The commit message carries [skip ci] so it does not start another run.
set -uo pipefail
dir="ci-logs/maestro-${RUN_ID}"
mkdir -p "$dir"
cp -f maestro-report.xml "$dir/" 2>/dev/null || true
for f in maestro-out/hierarchy-at-failure.txt maestro-out/logcat-tail.txt maestro-out/crash-buffer.txt maestro-out/annotations.txt; do
  [ -f "$f" ] && cp -f "$f" "$dir/"
done
# Keep a short index of what was saved and the outcome.
{
  echo "Maestro logs for CI run ${RUN_ID} (commit ${GITHUB_SHA:-unknown})"
  ls -la "$dir"
} > "$dir/README.txt"
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add ci-logs
if git diff --cached --quiet; then echo "No log changes to commit."; exit 0; fi
git commit -q -m "CI: Maestro logs for run ${RUN_ID} [skip ci]"
for attempt in 1 2 3; do
  git push -q origin "HEAD:refs/heads/${GITHUB_REF_NAME}" && { echo "Pushed logs."; exit 0; }
  git pull -q --rebase origin "${GITHUB_REF_NAME}" || exit 1
done
exit 1
