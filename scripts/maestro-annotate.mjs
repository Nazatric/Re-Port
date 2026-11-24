// Copies the first failure message from the Maestro JUnit report into a GitHub error annotation.
// Annotations are visible on the run page without downloading artifacts.
import { readFileSync, existsSync } from 'node:fs';

const file = 'maestro-report.xml';
const text = existsSync(file) ? readFileSync(file, 'utf8') : 'no maestro-report.xml was written';
const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const failures = [...text.matchAll(/<failure[^>]*message="([^"]*)"/g)].map((m) => decode(m[1]));
const message = (failures.join(' | ') || text.slice(0, 1500)).slice(0, 1500)
  .replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
console.log(`::error title=Maestro flow failed::${message}`);
