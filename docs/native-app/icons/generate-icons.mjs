// Generates the 6 launcher-icon colour variants (adaptive foreground + background + monochrome, 1024x1024), in the website's style:
// a gradient tile with a rounded badge holding the Zovix Z (see src/app/pwa-icon/[size]/route.tsx and src/components/ui/ZovixMark.tsx).
// The badge is ~40% of the canvas, well inside the 66% adaptive-icon safe zone, so no launcher mask crops it and it is not oversized.
// Usage (from the repo root): node docs/native-app/icons/generate-icons.mjs [outDir]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(process.env.NODE_PATH ? path.join(process.env.NODE_PATH, 'x.js') : import.meta.url);
const sharp = require('sharp');
const out = process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), 'source');
const SIZE = 1024;
// [gradient from, gradient to, badge colour, mark colour]. grape is the website's own violet and yellow.
export const VARIANTS = {
  grape: ['#7A52FF', '#4B27D6', '#FFC53D', '#3B2A00'],
  lime: ['#A3E635', '#4D7C0F', '#FFFFFF', '#1A2E05'],
  ocean: ['#38BDF8', '#1D4ED8', '#FFC53D', '#3B2A00'],
  sunset: ['#FDBA74', '#E11D48', '#FFFFFF', '#4C0519'],
  rose: ['#FDA4AF', '#BE123C', '#FFFFFF', '#4C0519'],
  mint: ['#6EE7B7', '#0F766E', '#FFFFFF', '#042F2E'],
};
const BADGE = 408; // px, 40% of the canvas
const X = (SIZE - BADGE) / 2;
const R = BADGE * 0.34;
const MARK = BADGE * 0.92; // the Z inside the badge
const markGroup = (stroke) =>
  `<g transform="translate(512,512) scale(${MARK / 48}) translate(-24,-24)" fill="none" stroke="${stroke}" stroke-linecap="round" stroke-linejoin="round"><polyline points="13,13 35,13 13,35 35,35" stroke-width="5.5"/><line x1="10" y1="20.5" x2="38" y2="20.5" stroke-width="3.4"/><line x1="10" y1="26.5" x2="38" y2="26.5" stroke-width="3.4"/></g>`;
const svg = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 1024 1024">${inner}</svg>`;
const badge = (fill) => `<rect x="${X}" y="${X}" width="${BADGE}" height="${BADGE}" rx="${R}" fill="${fill}"/>`;
const fgSvg = (badgeFill, mark) => svg(badge(badgeFill) + markGroup(mark));
const bgSvg = (a, b) =>
  svg(`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#g)"/>`);
// Themed (monochrome) icon: the badge as one solid shape with the Z cut out, so the system can tint it.
const monoSvg = () =>
  svg(`<defs><mask id="m"><rect width="1024" height="1024" fill="black"/>${badge('white')}${markGroup('black')}</mask></defs><rect width="1024" height="1024" fill="black" mask="url(#m)"/>`);
for (const [name, [a, b, tile, mark]] of Object.entries(VARIANTS)) {
  const dir = path.join(out, name);
  mkdirSync(dir, { recursive: true });
  await sharp(Buffer.from(fgSvg(tile, mark))).png().toFile(path.join(dir, 'foreground.png'));
  await sharp(Buffer.from(bgSvg(a, b))).png().toFile(path.join(dir, 'background.png'));
  await sharp(Buffer.from(monoSvg())).png().toFile(path.join(dir, 'monochrome.png'));
  // preview (what the launcher roughly shows)
  await sharp(Buffer.from(bgSvg(a, b))).composite([{ input: Buffer.from(fgSvg(tile, mark)) }]).png().toFile(path.join(dir, 'preview.png'));
  console.log('ok', name);
}
