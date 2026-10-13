// Generates the 6 launcher-icon colour variants (adaptive foreground + background + monochrome, 1024x1024).
// Usage: NODE_PATH=<native>/node_modules node generate-icons.mjs [outDir]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
const require = createRequire(process.env.NODE_PATH ? path.join(process.env.NODE_PATH, 'x.js') : import.meta.url);
const sharp = require('sharp');
import { fileURLToPath } from 'node:url';
const out = process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), 'source');
const SIZE = 1024;
export const VARIANTS = {
  lime:   ['#A3E635', '#4D7C0F'],
  ocean:  ['#38BDF8', '#1D4ED8'],
  sunset: ['#FDBA74', '#E11D48'],
  grape:  ['#A78BFA', '#5B21B6'],
  rose:   ['#FDA4AF', '#BE123C'],
  mint:   ['#6EE7B7', '#0F766E'],
};
// The website logo (src/components/ZovixMark.tsx): a bold Z crossed by two bars, as strokes in a 48 unit box, scaled into the 66% adaptive safe zone.
const fgSvg = (fill) => `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 1024 1024"><g transform="translate(512,512) scale(19) translate(-24,-24)" fill="none" stroke="${fill}" stroke-linecap="round" stroke-linejoin="round"><polyline points="13,13 35,13 13,35 35,35" stroke-width="5.5"/><line x1="10" y1="20.5" x2="38" y2="20.5" stroke-width="3.4"/><line x1="10" y1="26.5" x2="38" y2="26.5" stroke-width="3.4"/></g></svg>`;
const bgSvg = (a, b) => `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 1024 1024"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#g)"/></svg>`;
for (const [name, [a, b]] of Object.entries(VARIANTS)) {
  const dir = path.join(out, name); mkdirSync(dir, { recursive: true });
  await sharp(Buffer.from(fgSvg('#FFFFFF'))).png().toFile(path.join(dir, 'foreground.png'));
  await sharp(Buffer.from(bgSvg(a, b))).png().toFile(path.join(dir, 'background.png'));
  await sharp(Buffer.from(fgSvg('#000000'))).png().toFile(path.join(dir, 'monochrome.png'));
  // preview (what the launcher roughly shows, circle mask)
  await sharp(Buffer.from(bgSvg(a, b))).composite([{ input: Buffer.from(fgSvg('#FFFFFF')) }]).png().toFile(path.join(dir, 'preview.png'));
  console.log('ok', name);
}
