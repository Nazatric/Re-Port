import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const root = 'android/app/src/main/res';
const source = fs.readFileSync('public/icon.svg', 'utf8');
const inner = source.replace(/^\s*<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const adaptive = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><g transform="translate(97 97) scale(.62)">${inner}</g></svg>`;
const render = (svg, width) => new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
for (const [density, icon, foreground] of [['mdpi', 48, 108], ['hdpi', 72, 162], ['xhdpi', 96, 216], ['xxhdpi', 144, 324], ['xxxhdpi', 192, 432]]) {
  const dir = path.join(root, `mipmap-${density}`);
  fs.writeFileSync(path.join(dir, 'ic_launcher.png'), render(source, icon));
  fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), render(source, icon));
  fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), render(adaptive, foreground));
}
fs.writeFileSync(path.join(root, 'values/ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?><resources><color name="ic_launcher_background">#102918</color></resources>');
const splash = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#102918"/><g transform="translate(160 160) scale(.375)">${inner}</g></svg>`;
for (const dir of fs.readdirSync(root).filter((name) => name.startsWith('drawable'))) {
  const file = path.join(root, dir, 'splash.png');
  if (fs.existsSync(file)) fs.writeFileSync(file, render(splash, 1080));
}
console.log('Prepared Re:Port Android icons and splash.');
