// Item 4 follow-up: unsaved changes are never lost silently, not even by a redraw that is not a navigation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { HTML, slice } from './artifact-undo-kit.ts';

type F = { key: string; value: string; def: string };
type H = { ctx: string; m: Map<string, string> };
type K = {
  hold(fields: F[], ctx: string): H;
  restore(h: H, fields: F[], ctx: string, set: (f: F, v: string) => void): number;
};
const KEEP = vm.runInNewContext(`${slice('KEEPCORE')};KEEP`) as K;

const f = (key: string, value: string, def: string): F => ({ key, value, def });
const apply = (fields: F[]) => (x: F, v: string) => {
  fields.find((y) => y.key === x.key)!.value = v;
};

test('KEEP holds only fields that differ from their saved value', () => {
  const h = KEEP.hold([f('e-s', 'Dinner', 'Lunch'), f('e-n', '', ''), f('', 'x', 'y')], 'tx|7|0');
  assert.equal(JSON.stringify([...h.m]), '[["e-s","Dinner"]]');
});

test('KEEP puts typed values back into the rebuilt form (filter typing, quick add)', () => {
  const h = KEEP.hold([f('e-s', 'Dinner', 'Lunch'), f('e-a', '99', '50')], 'tx|7|0');
  const fresh = [f('e-s', 'Lunch', 'Lunch'), f('e-a', '50', '50')];
  assert.equal(KEEP.restore(h, fresh, 'tx|7|0', apply(fresh)), 2);
  assert.deepEqual(
    fresh.map((x) => x.value),
    ['Dinner', '99'],
  );
});

test('KEEP restores nothing when the view, the open entry or Edit mode changed', () => {
  const h = KEEP.hold([f('e-s', 'Dinner', 'Lunch')], 'tx|7|0');
  for (const ctx of ['bud|7|0', 'tx|8|0', 'tx|0|0', 'tx|7|1']) {
    const fresh = [f('e-s', 'Lunch', 'Lunch')];
    assert.equal(KEEP.restore(h, fresh, ctx, apply(fresh)), 0, ctx);
    assert.equal(fresh[0].value, 'Lunch');
  }
});

test('KEEP skips a field that no longer exists and never invents one', () => {
  const h = KEEP.hold([f('c:Food.cb', '300', '200'), f('c:Gone.cb', '5', '')], 'bud|0|1');
  const fresh = [f('c:Food.cb', '200', '200')];
  assert.equal(KEEP.restore(h, fresh, 'bud|0|1', apply(fresh)), 1);
  assert.equal(fresh[0].value, '300');
});

test('KEEP with nothing typed changes nothing', () => {
  const h = KEEP.hold([f('e-s', 'Lunch', 'Lunch')], 'tx|7|0');
  const fresh = [f('e-s', 'Lunch', 'Lunch')];
  assert.equal(KEEP.restore(h, fresh, 'tx|7|0', apply(fresh)), 0);
});

// ---- wiring: the redraw paths the QA Engineer reproduced and the ones found by reading ----
const fn = (name: string) => {
  const a = HTML.indexOf(`function ${name}(`);
  assert.ok(a >= 0, name);
  const b = HTML.indexOf('\nfunction ', a + 5);
  const c = HTML.indexOf('\nconst ', a + 5);
  return HTML.slice(a, Math.min(...[b, c].filter((x) => x > 0)));
};
const handler = (a: string) => HTML.match(new RegExp(`else if\\(a=='${a}'\\)[^\\n]*`))?.[0] ?? '';

test('draw() and lst() carry typed values across the rebuild', () => {
  assert.match(fn('draw'), /^function draw\(fresh\)\{const R=fresh\?null:holdForm\(\)/);
  assert.ok(fn('lst').includes('holdForm()'), 'lst holds');
  assert.ok(/R\(\)/.test(fn('lst')), 'lst restores');
  assert.ok(HTML.includes('KEEP.hold(') && HTML.includes('KEEP.restore('));
});

test('the filter box and Show more cannot reset an open editor', () => {
  assert.match(HTML, /if\(f\)\{F\[f\]=e\.target\.value;F\.n=50;lst\(\)\}/);
  assert.ok(handler('more').includes('lst()'));
});

test('quick add on a changed editor keeps the editor (draw keeps typed values)', () => {
  const s = fn('submit');
  assert.ok(s.includes('showMsg();draw()'), 'normal add redraws with draw()');
  assert.ok(!/draw\(1\)/.test(s), 'never a fresh redraw');
});

test('asking a question from quick add is a navigation and goes through the guard', () => {
  const s = fn('submit');
  assert.match(s, /gnav\(\(\)=>\{[^}]*S\.v='ask'/);
});

test('only an explicit reset may redraw fresh: discard of the Edit-mode form and a saved rule', () => {
  const uses = HTML.match(/draw\(1\)/g) || [];
  assert.equal(uses.length, 2);
  assert.ok(/discard:\(\)=>draw\(1\)/.test(HTML), 'discard');
  assert.ok(/draw\(1\);toast\('ruleSaved'\)/.test(HTML), 'rule saved');
});

test('the tour cannot swap the screen under a changed form', () => {
  for (const a of ['tst', 'tn', 'tb']) assert.ok(handler(a).includes('tourStep('), a);
  assert.match(fn('tourStep'), /gnav\(\(\)=>tourGo/);
});

test('deleting the entry being edited closes its editor', () => {
  assert.ok(handler('del').includes('if(ED==id)ED=0'));
});

test('Settings actions redraw with draw(), which keeps a half-typed recurring rule', () => {
  for (const a of ['sd', 'clr', 'exp', 'bkr', 'bkc', 'rest', 'pt', 'ps', 'cfx', 'urr', 'urc'])
    assert.ok(/draw\(\)/.test(handler(a)) && !/draw\(1\)/.test(handler(a)), a);
});

test('failed save: Budgets and Accounts roll back memory and the saved-value marks', () => {
  for (const name of ['commitBud', 'commitAcc']) {
    const s = fn(name);
    assert.ok(s.includes('snap=JSON.stringify(S)'), name + ' snapshot');
    assert.ok(s.includes('defs=[]'), name + ' remembers old marks');
    assert.match(
      s,
      /if\(!save\(\)&&STORE_OK\)\{[^}]*S=JSON\.parse\(snap\)[^}]*cats\(\)[^}]*undoMarks\(defs\)[^}]*return TOAST\.FAIL\}/,
      name + ' rollback',
    );
  }
});

test('a filter that would hide the entry being edited still shows its editor', () => {
  const s = fn('lst');
  assert.ok(s.includes('ex=ED&&!rows0.some(x=>x.id==ED)'), 'pins the edited entry');
  assert.ok(s.includes('rows=ex?[ex,...rows0]:rows0'));
  assert.ok(s.includes('a.length||ex?'), 'also when nothing else matches');
});

test('KEEP leaves a field alone when the user had not typed in it', () => {
  const h = KEEP.hold([f('e-s', 'Dinner', 'Lunch')], 'tx|7|0');
  const fresh = [f('e-s', 'Lunch', 'Lunch'), f('e-n', 'saved note', 'saved note')];
  assert.equal(KEEP.restore(h, fresh, 'tx|7|0', apply(fresh)), 1);
  assert.deepEqual(
    fresh.map((x) => x.value),
    ['Dinner', 'saved note'],
  );
});
