// Runs each browser smoke test in order. On failure it publishes the error text
// as a GitHub Actions annotation, so CI failures are readable without the raw log.
import { spawn } from 'node:child_process';

const scripts = ['smoke-web', 'smoke-profile-performance', 'smoke-overlays'];
const escape = (text) => text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

for (const name of scripts) {
  const { code, output } = await new Promise((resolve) => {
    const child = spawn(process.execPath, [`scripts/${name}.mjs`], { env: process.env });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; process.stdout.write(chunk); });
    child.stderr.on('data', (chunk) => { output += chunk; process.stderr.write(chunk); });
    child.on('close', (code) => resolve({ code, output }));
  });
  if (code !== 0) {
    const tail = output.trim().split('\n').slice(-40).join('\n').slice(-3000);
    console.log(`::error title=${name} failed::${escape(tail)}`);
    process.exit(code || 1);
  }
}
