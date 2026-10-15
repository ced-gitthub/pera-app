// Item 6: toasts. Shown only after a successful save; a new one replaces the old; 2200 ms.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { HTML, slice } from './artifact-undo-kit.ts';

type Env = { set(t: string): void; later(fn: () => void, ms: number): number; clear(id: number): void };
type Toast = {
  MS: number;
  TEXT: Record<string, string>;
  DEVICE: string;
  FAIL: string;
  make(env: Env): { show(k: string): boolean; busy(): boolean };
};
const TOAST = vm.runInNewContext(`${slice('TOASTCORE')};TOAST`) as Toast;

const rig = () => {
  const log: string[] = [];
  const timers = new Map<number, { fn: () => void; ms: number }>();
  let n = 0;
  const env: Env = {
    set: (t) => void log.push(t),
    later: (fn, ms) => {
      timers.set(++n, { fn, ms });
      return n;
    },
    clear: (id) => void timers.delete(id),
  };
  return { log, timers, t: TOAST.make(env) };
};

test('toast words', () => {
  assert.deepEqual(
    { ...TOAST.TEXT },
    {
      entrySaved: 'Entry saved',
      entryDeleted: 'Entry deleted',
      budgetSaved: 'Budget saved',
      budgetDeleted: 'Budget deleted',
      balances: 'Starting balances saved',
      accountSaved: 'Account saved',
      ruleSaved: 'Rule saved',
      ruleDeleted: 'Rule deleted',
    },
  );
  assert.equal(TOAST.MS, 2200);
  assert.equal(TOAST.FAIL, 'Not saved: could not write to this device. Try again.');
  assert.equal(TOAST.DEVICE, 'could not write to this device. Try again.');
});

test('show sets the text and clears it after 2200 ms', () => {
  const r = rig();
  assert.equal(r.t.show('entrySaved'), true);
  assert.deepEqual(r.log, ['Entry saved']);
  const [[, tm]] = [...r.timers];
  assert.equal(tm.ms, 2200);
  tm.fn();
  assert.deepEqual(r.log, ['Entry saved', '']);
  assert.equal(r.t.busy(), false);
});

test('a new toast replaces the old one and cancels its timer', () => {
  const r = rig();
  r.t.show('entrySaved');
  r.t.show('ruleSaved');
  assert.equal(r.timers.size, 1);
  assert.equal(r.log.at(-1), 'Rule saved');
});

test('an unknown key shows nothing', () => {
  const r = rig();
  assert.equal(r.t.show('nope'), false);
  assert.deepEqual(r.log, []);
});

test('wiring: live region, reduced motion, no toast before a save', () => {
  assert.match(HTML, /<div role="status" aria-live="polite" class="toast" id="toast">/);
  assert.match(HTML, /prefers-reduced-motion:reduce\)\{\.toast\{animation:none\}/);
  for (const k of ['entrySaved', 'entryDeleted', 'budgetSaved', 'budgetDeleted', 'balances', 'accountSaved', 'ruleSaved', 'ruleDeleted'])
    assert.ok(HTML.includes(`toast('${k}')`), k);
  // a failed save returns before any toast
  assert.match(HTML, /if\(!save\(\)&&STORE_OK\)\{S\.rec\.pop\(\);failLine\(\);return false\}draw\(\);toast\('ruleSaved'\)/);
  assert.match(HTML, /Object\.assign\(x,old\);eerr\(TOAST\.FAIL\);return false\}ED=0;lst\(\);toast\('entrySaved'\)/);
});
