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
// "Z" glyph, centred, inside the 66% adaptive-icon safe zone (centre 676px square).
const Z = 'M352 352 H672 Q700 352 700 380 V396 Q700 414 686 430 L468 672 H672 Q700 672 700 700 V716 Q700 744 672 744 H352 Q324 744 324 716 V700 Q324 682 338 666 L556 424 H352 Q324 424 324 396 V380 Q324 352 352 352 Z';
const fgSvg = (fill) => `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 1024 1024"><g transform="translate(0,-58)"><path d="${Z}" fill="${fill}"/></g></svg>`;
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
