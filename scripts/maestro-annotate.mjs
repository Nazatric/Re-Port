// Copies the Maestro failure into GitHub error annotations, so the reason is visible on the run page
// without downloading artifacts: the failing assertion, and the visible texts on screen at that moment.
import { readFileSync, existsSync } from 'node:fs';

const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const escape = (s) => s.slice(0, 1500).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

const report = existsSync('maestro-report.xml') ? readFileSync('maestro-report.xml', 'utf8') : 'no maestro-report.xml was written';
const failures = [...report.matchAll(/<failure[^>]*>([^<]*)<\/failure>/g)].map((m) => decode(m[1]).trim());
console.log(`::error title=Maestro flow failed::${escape(failures.join(' | ') || report.slice(0, 1500))}`);

if (existsSync('maestro-out/hierarchy-at-failure.txt')) {
  const hierarchy = readFileSync('maestro-out/hierarchy-at-failure.txt', 'utf8');
  const texts = [...hierarchy.matchAll(/"(?:text|accessibilityText|hintText)"\s*:\s*"([^"]{1,80})"/g)].map((m) => decode(m[1]).replace(/\s+/g, ' ').trim()).filter(Boolean);
  const unique = [...new Set(texts)].slice(0, 120);
  console.log(`::error title=Visible text at failure (${unique.length})::${escape(unique.join(' | '))}`);
}

// Crash evidence from the device: the Java exception lines and the app's process lines.
const logcat = ['maestro-out/crash-buffer.txt', 'maestro-out/logcat-tail.txt'].filter(existsSync).map((f) => readFileSync(f, 'utf8')).join('\n');
const crashLines = logcat.split('\n').filter((line) => /FATAL EXCEPTION|AndroidRuntime|Process: dev\.dandelion|ANR in|am_crash|died|Fatal signal/.test(line)).slice(0, 25);
console.log(`::error title=Device crash lines (${crashLines.length})::${escape(crashLines.join(' | ') || 'no crash lines found in logcat')}`);

