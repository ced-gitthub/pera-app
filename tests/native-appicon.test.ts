import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { THEME_IDS } from '../native/src/themeLogic.ts';
import {
  APP_ICON_NAMES,
  DEFAULT_APP_ICON,
  APP_ICON_KEY,
  isAppIconName,
  resolveAppIcon,
  iconForTheme,
  createAppIconApi,
  type IconStore,
} from '../native/src/appIcon.ts';

const mem = (fail = false): IconStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k) => {
      if (fail) throw new Error('disk');
      return data.get(k) ?? null;
    },
    setItem: async (k, v) => {
      if (fail) throw new Error('disk');
      data.set(k, v);
    },
  };
};

test('appicon: names are the six PascalCase colours and validation is strict', () => {
  assert.deepEqual([...APP_ICON_NAMES], ['Lime', 'Ocean', 'Sunset', 'Grape', 'Rose', 'Mint']);
  assert.ok(isAppIconName('Ocean'));
  for (const bad of ['ocean', 'Mono', '', null, undefined, 3, {}]) assert.ok(!isAppIconName(bad), String(bad));
  assert.equal(APP_ICON_KEY, 'zv_app_icon');
});

test('appicon: unknown names fall back to the default', () => {
  assert.equal(DEFAULT_APP_ICON, 'Grape');
  assert.equal(resolveAppIcon('Grape'), 'Grape');
  assert.equal(resolveAppIcon('nope'), 'Grape');
  assert.equal(resolveAppIcon(null), 'Grape');
});

test('appicon: every theme maps to a valid icon; colour themes match by name, the rest use the default', () => {
  for (const id of THEME_IDS) assert.ok(isAppIconName(iconForTheme(id)), id);
  assert.equal(iconForTheme('ocean'), 'Ocean');
  assert.equal(iconForTheme('mint'), 'Mint');
  assert.equal(iconForTheme('mono'), 'Grape');
  assert.equal(iconForTheme('daylight'), 'Grape');
  assert.equal(iconForTheme('bogus'), 'Grape');
});

test('appicon api: set calls the phone, remembers the choice and returns null', async () => {
  const store = mem();
  const calls: unknown[] = [];
  const api = createAppIconApi({ store, supported: true, setNative: async (n) => void calls.push(n), getNative: () => null });
  assert.equal(await api.setAppIcon('Sunset'), null);
  assert.deepEqual(calls, ['Sunset']);
  assert.equal(store.data.get('zv_app_icon'), 'Sunset');
});

test('appicon api: invalid name is refused with a message and nothing is called', async () => {
  const store = mem();
  let n = 0;
  const api = createAppIconApi({ store, supported: true, setNative: async () => void n++, getNative: () => null });
  const msg = await api.setAppIcon('Purple');
  assert.ok(msg && msg.length > 5);
  assert.equal(n, 0);
  assert.equal(store.data.size, 0);
});

test('appicon api: a native failure returns a friendly string, never throws, and keeps the old choice', async () => {
  const store = mem();
  store.data.set('zv_app_icon', 'Rose');
  const api = createAppIconApi({
    store,
    supported: true,
    setNative: async () => {
      throw new Error('E_NATIVE boom');
    },
    getNative: () => null,
  });
  const msg = await api.setAppIcon('Ocean');
  assert.ok(msg && !msg.includes('E_NATIVE'));
  assert.equal(store.data.get('zv_app_icon'), 'Rose');
});

test('appicon api: storage failure does not fail a change that worked', async () => {
  const api = createAppIconApi({ store: mem(true), supported: true, setNative: async () => {}, getNative: () => null });
  assert.equal(await api.setAppIcon('Mint'), null);
  assert.equal(await api.currentAppIcon(), null); // nothing readable, nothing reported
});

test('appicon api: current prefers the phone value, falls back to the stored choice, ignores junk', async () => {
  const store = mem();
  const mk = (native: unknown) => createAppIconApi({ store, supported: true, setNative: async () => {}, getNative: () => native as never });
  assert.equal(await mk(null).currentAppIcon(), null);
  store.data.set('zv_app_icon', 'Grape');
  assert.equal(await mk(null).currentAppIcon(), 'Grape');
  assert.equal(await mk('Mint').currentAppIcon(), 'Mint');
  assert.equal(await mk('Weird').currentAppIcon(), 'Grape');
  store.data.set('zv_app_icon', 'garbage');
  assert.equal(await mk(null).currentAppIcon(), null);
  const thrower = createAppIconApi({
    store,
    supported: true,
    setNative: async () => {},
    getNative: () => {
      throw new Error('x');
    },
  });
  assert.equal(await thrower.currentAppIcon(), null);
});

test('appicon api: unsupported platform is a safe no-op with a message', async () => {
  let n = 0;
  const api = createAppIconApi({ store: mem(), supported: false, setNative: async () => void n++, getNative: () => 'Mint' });
  assert.equal(api.supported, false);
  assert.ok((await api.setAppIcon('Ocean')) !== null);
  assert.equal(await api.currentAppIcon(), null);
  assert.equal(n, 0);
});

test('appicon: assets map covers every icon with a static require, and app.json keeps the zovix deep link on every alias', () => {
  const assets = fs.readFileSync('native/src/appIconAssets.ts', 'utf8');
  for (const n of APP_ICON_NAMES) assert.ok(assets.includes(`assets/icons/${n.toLowerCase()}/preview.png`), n);
  const app = JSON.parse(fs.readFileSync('native/app.json', 'utf8')).expo;
  const f = app.android.intentFilters;
  assert.ok(f.some((x: { data: { scheme: string }[] }) => x.data.some((d) => d.scheme === 'zovix')));
  const plugin = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-alternate-app-icons');
  assert.deepEqual(
    plugin[1].map((i: { name: string }) => i.name),
    [...APP_ICON_NAMES],
  );
  for (const i of plugin[1])
    for (const k of ['foregroundImage', 'backgroundImage', 'monochromeImage'])
      assert.ok(fs.existsSync('native/' + i.android[k]), i.android[k]);
});

test('the icon can be changed once per app session: a second change before a restart is refused (two launcher icons otherwise)', async () => {
  const calls: string[] = [];
  const api = createAppIconApi({
    supported: true,
    store: { getItem: async () => null, setItem: async () => {} },
    setNative: async (n: string) => void calls.push(n),
    getNative: () => null,
  } as never);
  assert.equal(await api.setAppIcon('Ocean'), null);
  const second = await api.setAppIcon('Sunset');
  assert.match(second ?? '', /restart/i);
  assert.deepEqual(calls, ['Ocean']);
});

test('a failed change does not use up the one change', async () => {
  let n = 0;
  const api = createAppIconApi({
    supported: true,
    store: { getItem: async () => null, setItem: async () => {} },
    setNative: async () => {
      if (n++ === 0) throw new Error('boom');
    },
    getNative: () => null,
  } as never);
  assert.ok(await api.setAppIcon('Ocean'));
  assert.equal(await api.setAppIcon('Ocean'), null);
});

test('appicon: the launcher icon matches the website (violet tile) and the mark is compact', () => {
  const app = JSON.parse(fs.readFileSync('native/app.json', 'utf8')).expo;
  assert.equal(app.icon, './assets/icons/grape/preview.png');
  assert.equal(app.android.adaptiveIcon.foregroundImage, './assets/icons/grape/foreground.png');
  assert.equal(app.android.adaptiveIcon.backgroundColor, '#4B27D6'); // the website's violet
  const gen = fs.readFileSync('docs/native-app/icons/generate-icons.mjs', 'utf8');
  assert.match(gen, /grape: \['#7A52FF', '#4B27D6', '#FFC53D'/); // the website's gradient and yellow badge
  const badge = Number(/const BADGE = (\d+)/.exec(gen)?.[1]);
  assert.ok(badge > 0 && badge <= 1024 * 0.45, 'the badge stays well inside the 66% adaptive-icon safe zone');
});
