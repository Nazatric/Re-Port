#!/usr/bin/env node
/**
 * Produces every icon and splash PNG from one source mark.
 *
 * Preferred source: assets/icon-source.svg (vector, renders razor sharp at any size).
 * Also accepted:   assets/icon-source.png (a supplied raster) or public/icon.svg (fallback).
 *
 * Outputs: public/icon.svg, public/icon-192.png, public/icon-512.png, assets/icon-only.png,
 *          assets/icon-foreground.png, assets/icon-background.png, assets/splash*.png
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Resvg } from '@resvg/resvg-js';

const root = process.cwd();
const abs = (f) => path.join(root, f);
const svgSource = abs('assets/icon-source.svg');
const pngSource = abs('assets/icon-source.png');
const mark = fs.existsSync(svgSource) ? fs.readFileSync(svgSource, 'utf8') : null;

function render(png, width, background) {
  return new Resvg(png, { fitTo: { mode: 'width', value: width }, background: background || 'rgba(0,0,0,0)' }).render().asPng();
}

function writeSvgSource(svg, out, width, background) {
  fs.mkdirSync(path.dirname(abs(out)), { recursive: true });
  fs.writeFileSync(abs(out), render(svg, width, background));
  console.log('svg ', out);
}

/** The adaptive foreground keeps the artwork but drops the full-frame plate, which the background layer owns. */
function withoutPlate(svg) {
  return svg.replace(/<rect\s+width="512"\s+height="512"\s+fill="[^"]*"\s*\/>/, '');
}

function writeRasterSource(out, size, background = 'none') {
  fs.mkdirSync(path.dirname(abs(out)), { recursive: true });
  execFileSync('convert', [pngSource, '-background', background, '-resize', `${size}x${size}`, '-gravity', 'center', '-extent', `${size}x${size}`, `PNG32:${abs(out)}`]);
  console.log('png ', out);
}

/** Renders the mark large and centred on a solid canvas, for the app's launch screen. */
function makeSplash(out, bg, markSvg) {
  const canvas = 2732;
  const draw = 1160;
  const offset = (canvas - draw) / 2;
  const scale = draw / 512; // the mark is authored inside a 512 viewBox
  const inner = markSvg.slice(markSvg.indexOf('>') + 1, markSvg.lastIndexOf('</svg>'));
  const defs = /<defs>[\s\S]*?<\/defs>/.exec(inner)?.[0] ?? '';
  const body = inner.replace(/<defs>[\s\S]*?<\/defs>/, '');
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas}" height="${canvas}" viewBox="0 0 ${canvas} ${canvas}">`,
    defs,
    `<rect width="${canvas}" height="${canvas}" fill="${bg}"/>`,
    `<g transform="translate(${offset} ${offset}) scale(${scale})">${body}</g>`,
    '</svg>',
  ].join('');
  fs.mkdirSync(path.dirname(abs(out)), { recursive: true });
  fs.writeFileSync(abs(out), render(svg, canvas, bg));
  console.log('splash', out);
}

const BG = '#04060a';

if (mark) {
  // The web app needs an SVG icon as well, so keep the mark in the public root.
  fs.writeFileSync(abs('public/icon.svg'), mark);
  writeSvgSource(mark, 'public/icon-192.png', 192);
  writeSvgSource(mark, 'public/icon-512.png', 512);
  writeSvgSource(mark, 'assets/icon-only.png', 1024);
  // Adaptive launcher: the glyph layer stays transparent, the back plate stays solid.
  writeSvgSource(withoutPlate(mark), 'assets/icon-foreground.png', 1024);
  execFileSync('convert', ['-size', '1024x1024', `xc:${BG}`, `PNG32:${abs('assets/icon-background.png')}`]);
  console.log('solid assets/icon-background.png');
  makeSplash('assets/splash.png', BG, mark);
  makeSplash('assets/splash-dark.png', '#05070a', mark);
} else if (fs.existsSync(pngSource)) {
  console.log('Using raster source assets/icon-source.png');
  writeRasterSource('public/icon-192.png', 192);
  writeRasterSource('public/icon-512.png', 512);
  writeRasterSource('assets/icon-only.png', 1024);
  writeRasterSource('assets/icon-foreground.png', 1024);
  execFileSync('convert', ['-size', '1024x1024', `xc:${BG}`, `PNG32:${abs('assets/icon-background.png')}`]);
  writeRasterSource('assets/splash.png', 1600, BG);
  writeRasterSource('assets/splash-dark.png', 1600, '#05070a');
} else {
  console.warn('\nNo assets/icon-source.svg or .png found. Rendering the generic fallback artwork.\n');
  const icon = fs.readFileSync(abs('public/icon.svg'), 'utf8');
  writeSvgSource(icon, 'public/icon-192.png', 192);
  writeSvgSource(icon, 'public/icon-512.png', 512);
  writeSvgSource(icon, 'assets/icon-only.png', 1024);
  writeSvgSource(fs.readFileSync(abs('assets/icon-foreground.svg'), 'utf8'), 'assets/icon-foreground.png', 1024);
  writeSvgSource(fs.readFileSync(abs('assets/icon-background.svg'), 'utf8'), 'assets/icon-background.png', 1024);
}
