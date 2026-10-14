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
  ICON_PENDING_TEXT,
  ICON_APPLY_NOW_WARNING,
  APP_ICON_PENDING_KEY,
  shouldApplyIconNow,
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
    removeItem: async (k) => {
      if (fail) throw new Error('disk');
      data.delete(k);
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

test('icon change is QUEUED, never applied while the person is using the app (Android closes the app to switch icons)', async () => {
  const store = mem();
  const calls: unknown[] = [];
  const api = createAppIconApi({ store, supported: true, setNative: async (n) => void calls.push(n), getNative: () => null });
  assert.equal(await api.queueAppIcon('Sunset'), null);
  assert.deepEqual(calls, [], 'nothing native yet');
  assert.equal(store.data.get('zv_app_icon_pending'), 'Sunset');
  assert.equal(await api.pendingAppIcon(), 'Sunset');
  // picking again just replaces the pending choice: nothing is ever "stuck"
  assert.equal(await api.queueAppIcon('Ocean'), null);
  assert.equal(await api.queueAppIcon('Rose'), null);
  assert.equal(await api.pendingAppIcon(), 'Rose');
  assert.deepEqual(calls, []);
});

test('apply: when the app is left, the pending icon is applied once, remembered, and the pending choice cleared', async () => {
  const store = mem();
  const calls: unknown[] = [];
  const api = createAppIconApi({ store, supported: true, setNative: async (n) => void calls.push(n), getNative: () => null });
  await api.queueAppIcon('Ocean');
  assert.equal(await api.applyPendingAppIcon(), null);
  assert.deepEqual(calls, ['Ocean']);
  assert.equal(store.data.get('zv_app_icon'), 'Ocean');
  assert.equal(store.data.has('zv_app_icon_pending'), false);
  assert.equal(await api.applyPendingAppIcon(), null);
  assert.deepEqual(calls, ['Ocean'], 'a second apply with nothing pending does nothing');
});

test('apply: a native failure keeps the choice pending, gives a friendly message and never throws', async () => {
  const store = mem();
  const api = createAppIconApi({
    store,
    supported: true,
    setNative: async () => {
      throw new Error('E_NATIVE boom');
    },
    getNative: () => null,
  });
  await api.queueAppIcon('Ocean');
  const msg = await api.applyPendingAppIcon();
  assert.ok(msg && !msg.includes('E_NATIVE'));
  assert.equal(store.data.get('zv_app_icon_pending'), 'Ocean');
});

test('apply: the icon already in use is not set again (no needless app close), and the pending choice is cleared', async () => {
  const store = mem();
  let n = 0;
  const api = createAppIconApi({ store, supported: true, setNative: async () => void n++, getNative: () => 'Ocean' });
  await api.queueAppIcon('Ocean');
  assert.equal(await api.applyPendingAppIcon(), null);
  assert.equal(n, 0);
  assert.equal(store.data.has('zv_app_icon_pending'), false);
});

test('queue: an invalid name is refused with a message, and an unsupported platform is a safe no-op with a message', async () => {
  const store = mem();
  const api = createAppIconApi({ store, supported: true, setNative: async () => {}, getNative: () => null });
  const msg = await api.queueAppIcon('Purple');
  assert.ok(msg && msg.length > 5);
  assert.equal(store.data.size, 0);
  let n = 0;
  const off = createAppIconApi({ store: mem(), supported: false, setNative: async () => void n++, getNative: () => 'Mint' });
  assert.equal(off.supported, false);
  assert.ok((await off.queueAppIcon('Ocean')) !== null);
  assert.equal(await off.applyPendingAppIcon(), null);
  assert.equal(await off.currentAppIcon(), null);
  assert.equal(n, 0);
  assert.ok(
    (await createAppIconApi({ store: mem(true), supported: true, setNative: async () => {}, getNative: () => null }).queueAppIcon(
      'Mint',
    )) !== null,
  );
});

test('the warning words say WHEN it changes and that the app closes', () => {
  assert.match(ICON_PENDING_TEXT('Ocean'), /Ocean/);
  assert.match(ICON_PENDING_TEXT('Ocean'), /leave Zovix|press Home/i);
  assert.match(ICON_PENDING_TEXT('Ocean'), /close/i);
  assert.match(ICON_PENDING_TEXT('Ocean'), /open Zovix again/i);
  assert.match(ICON_APPLY_NOW_WARNING, /close/i);
  assert.match(ICON_APPLY_NOW_WARNING, /open Zovix again/i);
});

test('the icon section queues and warns (it never changes the icon on tap), and offers Apply now only behind a confirmation', () => {
  const src = fs.readFileSync('native/src/AppIconSection.tsx', 'utf8');
  assert.match(src, /queueAppIcon/);
  assert.doesNotMatch(src, /setAppIcon/);
  assert.match(src, /Alert\.alert/);
  assert.match(src, /Apply now/);
  assert.match(src, /ICON_PENDING_TEXT/);
  const gate = fs.readFileSync('native/src/Gate.tsx', 'utf8');
  assert.match(gate, /applyPendingAppIcon/);
  assert.match(fs.readFileSync('native/src/leaveWatcher.ts', 'utf8'), /'background'/); // applied when the person leaves the app (the watcher has its own behaviour tests)
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

test('the icon is applied only when the person has really left: app in the background AND no in-app external screen (share sheet) open', () => {
  assert.equal(shouldApplyIconNow('background', 0), true);
  assert.equal(shouldApplyIconNow('active', 0), false);
  assert.equal(shouldApplyIconNow('inactive', 0), false);
  assert.equal(shouldApplyIconNow('background', 1), false); // Zovix itself opened the share sheet (Android reports "background")
});

test('external screens opened by the app are counted (nested too), an error still closes the count, and the Csv share sheet is wrapped', async () => {
  const ext = await import('../native/src/externalActivity.ts');
  ext.noteActive();
  assert.equal(ext.externalOpen(), 0);
  await ext.withExternal(async () => {
    assert.ok(ext.externalOpen() >= 1);
    await ext.withExternal(async () => assert.ok(ext.externalOpen() >= 2));
  });
  await assert.rejects(ext.withExternal(async () => Promise.reject(new Error('x'))));
  ext.noteActive(); // the app is back in front: nothing is open any more
  assert.equal(ext.externalOpen(), 0);
  assert.match(fs.readFileSync('native/src/Csv.tsx', 'utf8'), /withExternal\(/);
});

test('Gate applies the queued icon only after a short delay and re-checks that the app is still in the background', () => {
  const g = fs.readFileSync('native/src/Gate.tsx', 'utf8');
  assert.match(g, /createLeaveWatcher\(/);
  assert.match(g, /getState: \(\) => AppState\.currentState/);
  assert.match(g, /externalOpen,/);
  const w = fs.readFileSync('native/src/leaveWatcher.ts', 'utf8');
  assert.match(w, /shouldApplyIconNow\(d\.getState\(\), d\.externalOpen\(\)\)/);
  assert.match(w, /d\.setTimer\(/);
  assert.match(w, /d\.clearTimer\(/); // coming back cancels it
});

test('apply writes the new state BEFORE the native call (Android may close the app during it), and puts the queue back if the call fails', async () => {
  const store = mem();
  let release: () => void = () => {};
  const api = createAppIconApi({
    store,
    supported: true,
    setNative: () => new Promise<void>((res) => (release = res)),
    getNative: () => null,
  });
  await api.queueAppIcon('Ocean');
  const running = api.applyPendingAppIcon(); // never awaited: the app "dies" here
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(store.data.get('zv_app_icon'), 'Ocean');
  assert.equal(store.data.has(APP_ICON_PENDING_KEY), false);
  release();
  await running;
  // failure: the earlier icon and the queued choice come back
  const store2 = mem();
  store2.data.set('zv_app_icon', 'Rose');
  const bad = createAppIconApi({
    store: store2,
    supported: true,
    setNative: async () => {
      throw new Error('boom');
    },
    getNative: () => null,
  });
  await bad.queueAppIcon('Ocean');
  assert.ok(await bad.applyPendingAppIcon());
  assert.equal(store2.data.get('zv_app_icon'), 'Rose');
  assert.equal(store2.data.get(APP_ICON_PENDING_KEY), 'Ocean');
});

test('the share sheet cannot sneak an icon change in: the mark stays until the app is back in front, even though Share.share resolves early', async () => {
  const ext = await import('../native/src/externalActivity.ts');
  ext.noteActive(); // clean slate
  // Android: Share.share resolves right after the sheet is launched, BEFORE the app is reported as "background"
  await ext.withExternal(async () => {});
  assert.equal(ext.externalOpen() > 0, true, 'still marked after the promise resolved');
  assert.equal(shouldApplyIconNow('background', ext.externalOpen()), false);
  ext.noteBackground(); // the app goes to the background behind the sheet
  assert.equal(ext.externalOpen() > 0, true);
  ext.noteActive(); // the person is back
  assert.equal(ext.externalOpen(), 0);
  assert.equal(shouldApplyIconNow('background', ext.externalOpen()), true); // a later real leave applies the icon
});

test('if the share sheet never sends the app to the background, the mark expires on its own (the next real leave still applies the icon)', async () => {
  const ext = await import('../native/src/externalActivity.ts');
  ext.noteActive();
  ext.markExternal(15);
  assert.equal(ext.externalOpen() > 0, true);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(ext.externalOpen(), 0);
  // but once the app did go to the background, it does not expire: it waits for the return
  ext.markExternal(15);
  ext.noteBackground();
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(ext.externalOpen() > 0, true);
  ext.noteActive();
  assert.equal(ext.externalOpen(), 0);
});

test('Gate tells the external-activity tracker about background and active', () => {
  const g = fs.readFileSync('native/src/Gate.tsx', 'utf8');
  assert.match(g, /noteBackground,/);
  assert.match(g, /noteActive,/);
  const w = fs.readFileSync('native/src/leaveWatcher.ts', 'utf8');
  assert.match(w, /d\.noteBackground\(\)/);
  assert.match(w, /d\.noteActive\(\)/);
});

test('the icon picker never rearranges when you choose: fixed three-column cells, a label that never changes, no "(soon)", the check is a badge on the icon', () => {
  const src = fs.readFileSync('native/src/AppIconSection.tsx', 'utf8');
  assert.doesNotMatch(src, /\(soon\)/);
  const grid = src.slice(src.indexOf('APP_ICON_NAMES.map'), src.indexOf('Match my theme'));
  assert.match(grid, /width: '33%'/); // every tile has the same fixed cell, so nothing wraps to another row
  assert.match(grid, /numberOfLines=\{1\}/); // one line: the label can never change a tile's height
  assert.doesNotMatch(grid, /\{on \? '✓ ' : ''\}/); // the old label prefix changed the tile's width
  const label = grid.slice(grid.indexOf('<Text numberOfLines={1}'), grid.indexOf('</Text>', grid.indexOf('<Text numberOfLines={1}')));
  assert.equal(label.slice(label.indexOf('>') + 1).trim(), '{name}'); // the visible label is the name and nothing else
  assert.match(grid, /position: 'absolute'/); // the check mark is a badge on the icon, not part of the text
  assert.match(grid, /\{name\}/);
  // the order is the fixed list order, never sorted by selection
  assert.doesNotMatch(grid, /\.sort\(|\.reverse\(|\.filter\(/);
});
