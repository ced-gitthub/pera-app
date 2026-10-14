import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { UNSAVED_TEXT_ANY, unsavedButtons } from '../native/src/unsaved.ts';
import { UNSAVED_DISCARD, UNSAVED_KEEP, UNSAVED_SAVE } from '../native/src/profileLogic.ts';

const read = (f: string) => fs.readFileSync(`native/src/${f}`, 'utf8');

test('unsaved prompt buttons: Keep editing (cancel), Discard (closes), Save (closes only when the save worked); no Save button when there is nothing to save with', async () => {
  const log: string[] = [];
  const b = unsavedButtons({ onClose: () => void log.push('close'), onSave: async () => (log.push('save'), true) });
  assert.deepEqual(
    b.map((x) => x.text),
    [UNSAVED_KEEP, UNSAVED_DISCARD, UNSAVED_SAVE],
  );
  assert.equal(b[0].style, 'cancel');
  assert.equal(b[1].style, 'destructive');
  b[1].onPress?.();
  assert.deepEqual(log, ['close']);
  log.length = 0;
  await b[2].onPress?.();
  assert.deepEqual(log, ['save', 'close']);
  // a failed save keeps the sheet open (the problem is shown on the sheet)
  const log2: string[] = [];
  const bad = unsavedButtons({ onClose: () => void log2.push('close'), onSave: async () => false });
  await bad[2].onPress?.();
  assert.deepEqual(log2, []);
  const noSave = unsavedButtons({ onClose: () => {} });
  assert.deepEqual(
    noSave.map((x) => x.text),
    [UNSAVED_KEEP, UNSAVED_DISCARD],
  );
  assert.match(UNSAVED_TEXT_ANY, /changed|not saved/i);
});

test('Sheet guards EVERY way to close it: the header Done, a tap outside and the Android back button', () => {
  const sheet = read('Sheet.tsx');
  assert.match(sheet, /dirty\??:/);
  assert.match(sheet, /onSave\??:/);
  assert.match(sheet, /const requestClose = /);
  assert.match(sheet, /unsavedButtons\(/);
  assert.match(sheet, /onRequestClose=\{requestClose\}/);
  assert.match(sheet, /<HeaderClose onPress=\{requestClose\}/);
  assert.match(sheet, /onPress=\{requestClose\} accessibilityLabel="Close"/);
});

test('one app-wide pop-out confirmation (a centred card with a check) any screen can call after a save', () => {
  const toast = read('Toast.tsx');
  assert.match(toast, /export function ToastProvider/);
  assert.match(toast, /export const useToast/);
  assert.match(toast, /export function ToastCard/);
  assert.match(toast, /accessibilityLiveRegion="assertive"/);
  assert.match(toast, /✓/);
  const app = read('App.tsx');
  assert.match(app, /<ToastProvider>/);
  // the provider sits OUTSIDE the themed (remounting) tree, so a theme change never drops a visible confirmation
  assert.ok(app.indexOf('<ToastProvider>') < app.indexOf('key={themeKey}'));
  const sheet = read('Sheet.tsx');
  assert.match(sheet, /ToastCard/); // the sheet's own toast and the app-wide one look the same
});
