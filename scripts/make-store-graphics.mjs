// Generates the Google Play graphics into docs/play-store/. Run: node scripts/make-store-graphics.mjs
// Uses the same generator the app uses for its install icons (next/og), so no design tool is needed.
import fs from 'node:fs';
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js';

const out = 'docs/play-store';
fs.mkdirSync(out, { recursive: true });
const el = (type, props, ...children) => ({ type, props: { ...props, children: children.length === 1 ? children[0] : children } });
const save = async (name, node, width, height) => {
  const res = new ImageResponse(node, { width, height });
  fs.writeFileSync(`${out}/${name}`, Buffer.from(await res.arrayBuffer()));
  console.log('wrote', name, width + 'x' + height);
};

// App icon: 512x512 square, full bleed (Google Play applies its own rounded mask).
await save(
  'icon-512.png',
  el(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#5b35e8',
        color: '#ffffff',
        fontSize: 320,
        fontWeight: 800,
      },
    },
    'Z',
  ),
  512,
  512,
);

// Feature graphic: 1024x500.
await save(
  'feature-graphic-1024x500.png',
  el(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #5b35e8, #8b5cf6)',
        color: '#ffffff',
      },
    },
    el('div', { style: { fontSize: 140, fontWeight: 800, letterSpacing: -4 } }, 'Zovix'),
    el('div', { style: { fontSize: 44, marginTop: 8 } }, 'Budget and money tracker'),
    el('div', { style: { fontSize: 30, marginTop: 28, opacity: 0.9 } }, 'Type it. Done.'),
  ),
  1024,
  500,
);
