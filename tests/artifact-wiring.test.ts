// QA reject of 82679b5: screen changes must survive sync(), new-account/category boxes are guarded and kept,
// and the page's redraw helpers (vctx, fkey, hfields, draw) are run for real against a stub DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { HTML, slice, type St } from './artifact-undo-kit.ts';

type Obj = St;
const handler = (a: string) => HTML.match(new RegExp(`else if\\(a=='${a}'\\)[^\\n]*`))?.[0] ?? '';
const fnSrc = (name: string) => {
  const a = HTML.indexOf(`function ${name}(`);
  assert.ok(a >= 0, name);
  const b = HTML.indexOf('\nfunction ', a + 5);
  const c = HTML.indexOf('\nconst ', a + 5);
  return HTML.slice(a, Math.min(...[b, c].filter((x) => x > 0)));
};

// ---- sync(): a click must not undo the screen the user is on ----
const syncSrc = HTML.match(/function sync\(\)[^\n]*/)![0];
const storage = (init: Obj) => {
  const store = new Map<string, string>(Object.entries(init).map(([k, v]) => [k, JSON.stringify(v)]));
  return {
    store,
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) },
  };
};
function page(stored: Obj, mem: Obj) {
  const st = storage({ mt1: stored });
  const ctx = vm.createContext({ localStorage: st.localStorage, cats() {}, JSON, Array });
  vm.runInContext(`let S=${JSON.stringify(mem)};${syncSrc};this.get=()=>S;this.setV=v=>{S.v=v}`, ctx);
  return ctx as Obj;
}

test('sync() reloads saved data but keeps the screen the user is on', () => {
  const p = page({ v: 'home', tx: [{ id: 'a' }, { id: 'b' }] }, { v: 'tx', tx: [] });
  p.sync();
  assert.equal(p.get().tx.length, 2, 'data reloaded');
  assert.equal(p.get().v, 'tx', 'screen kept');
});

test('sync() takes the saved screen only when this page has none yet', () => {
  const p = page({ v: 'bud', tx: [] }, { tx: [] });
  p.sync();
  assert.equal(p.get().v, 'bud');
});

test('a tour step then any click stays on the step screen (tour -> sync -> still there)', () => {
  const p = page({ v: 'home', tx: [] }, { v: 'home', tx: [] });
  p.setV('tx'); // tourGo to Transactions
  p.sync(); // the Edit click
  p.sync(); // and the next one
  assert.equal(p.get().v, 'tx');
});

test('Clear everything from the Keep/Clear card: after the clear the user is on Settings with the result', () => {
  const base = {
    v: 'home',
    tx: [{ id: 't1', n: 1, date: '2026-10-01', type: 'expense', amount: 10, cat: 'Food', acct: 'Cash' }],
    trash: [],
    bud: {},
    rec: [],
    open: {},
    accts: ['Cash'],
    alias: {},
    cats: { inc: [], exp: [] },
  };
  const st = storage({ mt1: base });
  const ctx = vm.createContext({ localStorage: st.localStorage, cats() {}, JSON, Array, Date, Object, Math, Number, String, Map, Set });
  vm.runInContext(
    `${slice('UNDOCORE')};let S=JSON.parse(localStorage.getItem('mt1'));${syncSrc};
     const save=()=>{localStorage.setItem('mt1',JSON.stringify(S));return true};
     S.v='set';
     this.UN=UNDOCORE({S:()=>S,sync,save:()=>save(),now:()=>1800000000000,store:localStorage,uid:p=>p+'_1'});this.cur=()=>S.v`,
    ctx,
  );
  const r = (ctx as Obj).UN.clearAll('DELETE');
  assert.equal(r.ok, true, r.message);
  assert.equal((ctx as Obj).cur(), 'set', 'still on Settings, where the result and Undo card are drawn');
  const saved = JSON.parse(st.store.get('mt1')!);
  assert.equal(saved.v, 'set');
  assert.equal(saved.tx.length, 0);
});

test('every place that sets the screen saves it except the tour (S.v= is followed by save())', () => {
  // sync() restoring the in-memory screen is not a navigation
  const hits = [...HTML.matchAll(/S\.v=(?!=|v;S\.rec)/g)];
  assert.ok(hits.length >= 4, 'tab, question, Keep/Clear card, tour');
  const tg = HTML.indexOf('function tourGo(');
  for (const h of hits.filter((x) => x.index! < tg || x.index! > tg + 300))
    assert.ok(/save\(\)/.test(HTML.slice(h.index!, h.index! + 160)), HTML.slice(h.index!, h.index! + 60));
});

test('Keep/Clear card and the question path save the screen change', () => {
  assert.ok(/S\.v='set';[^]{0,80}save\(\)/.test(handler('kcc')), 'kcc');
  assert.ok(/S\.v='ask';[^]{0,80}save\(\)/.test(fnSrc('submit')), 'question');
});

// ---- tour: prompt only when the tab changes ----
test('tour Next/Back/Start only ask about a dirty form when the tab changes', () => {
  const s = fnSrc('tourStep');
  assert.match(s, /!==S\.v/, 'compares with the current tab');
  assert.ok(/gnav\(/.test(s), 'still guarded when the tab changes');
  for (const a of ['tst', 'tn', 'tb']) assert.ok(handler(a).includes('tourStep('), a);
  for (const a of ['tst', 'tn', 'tb']) assert.ok(!handler(a).includes('gnav('), a + ' is not guarded unconditionally');
});

test('tourGo changes the screen in memory only (no data written); sync() is what keeps it', () => {
  assert.ok(!/save\(/.test(fnSrc('tourGo')));
});

// ---- new account / new category boxes are guarded and kept ----
test('#na and the new-category boxes are in the unsaved guard', () => {
  const e = HTML.match(/EDSEL='([^']*)'/)![1];
  for (const id of ['#na', '#nc-n-income', '#nc-n-expense', '#nc-k-income', '#nc-k-expense']) assert.ok(e.split(',').includes(id), id);
});

test('guard Save also adds the typed account / category; adding clears the box so draw cannot bring it back', () => {
  assert.ok(/commitTab\(\)\|\|addPending\(\)/.test(HTML), 'guard Save');
  assert.ok(/e\.value=''/.test(fnSrc('addAcct')), 'account box cleared');
  assert.ok(/\.value=''/.test(handler('ca')), 'category boxes cleared');
  assert.match(handler('na'), /addAcct\(1\)/);
  assert.match(fnSrc('addPending'), /addAcct\(\)[^]*catAdd\(/);
});

// ---- quick add: deleting the entry being edited ----
test('quick add that removes the entry being edited closes its editor', () => {
  assert.match(fnSrc('submit'), /if\(ED&&!S\.tx\.some\(y=>y\.id==ED\)\)ED=0/);
});

// ---- the redraw helpers, run for real ----
const start = HTML.indexOf("let VCTX='';");
const end = HTML.indexOf('\nfunction drawNow(');
assert.ok(start > 0 && end > start);
const helpers = HTML.slice(start, end);

type El = {
  id: string;
  tagName: string;
  value: string;
  defaultValue: string;
  classList: { contains(c: string): boolean };
  closest(s: string): unknown;
  options?: unknown[];
};
function dom() {
  const els: El[] = [];
  const sels: string[] = [];
  const g = {
    document: {
      querySelectorAll(sel: string) {
        sels.push(sel);
        return els.filter((e) => e.tagName !== 'SELECT' || sel.includes('select'));
      },
    },
    drawNow() {
      for (const e of els) e.value = e.defaultValue; // a rebuild wipes typed text
    },
    KEEP: vm.runInNewContext(`${slice('KEEPCORE')};KEEP`),
  };
  const ctx = vm.createContext(g);
  vm.runInContext(
    `let S={v:'tx'},ED=0,EM=0;${helpers};this.api={fkey,fdef,hfields,vctx,draw,go:(v,ed,em)=>{S.v=v;ED=ed;EM=em},ctx:()=>VCTX}`,
    ctx,
  );
  const add = (id: string, o: { cls?: string; row?: Record<string, string>; tag?: string; def?: string; value?: string } = {}) => {
    const e: El = {
      id,
      tagName: o.tag ?? 'INPUT',
      value: o.value ?? o.def ?? '',
      defaultValue: o.def ?? '',
      classList: { contains: (c: string) => c === o.cls },
      closest: () => (o.row ? { dataset: o.row } : null),
      options: o.tag === 'SELECT' ? [{ value: 'x', defaultSelected: true }] : undefined,
    };
    els.push(e);
    return e;
  };
  return { api: (ctx as Obj).api as Obj, add, sels };
}

test('fkey names entry/rule/new-item fields by id and account/category fields by row + class', () => {
  const d = dom();
  assert.equal(d.api.fkey(d.add('e-s')), 'e-s');
  assert.equal(d.api.fkey(d.add('r-a')), 'r-a');
  assert.equal(d.api.fkey(d.add('na')), 'na');
  assert.equal(d.api.fkey(d.add('nc-n-income')), 'nc-n-income');
  assert.equal(d.api.fkey(d.add('', { cls: 'cb', row: { cat: 'Food' } })), 'c:Food.cb');
  assert.equal(d.api.fkey(d.add('', { cls: 'an', row: { acct: '2' } })), 'a:2.an');
  assert.equal(d.api.fkey(d.add('', { cls: 'cn', row: { cat: 'Food' } })), 'c:Food.cn');
  assert.equal(d.api.fkey(d.add('', { cls: 'zz', row: { cat: 'Food' } })), '');
  assert.equal(d.api.fkey(d.add('', { cls: 'cb' })), '');
});

test('vctx changes with the screen, the open entry and Edit mode', () => {
  const d = dom();
  const a = d.api.vctx();
  d.api.go('tx', 7, 0);
  const b = d.api.vctx();
  d.api.go('tx', 7, 1);
  const c = d.api.vctx();
  d.api.go('bud', 7, 1);
  assert.equal(new Set([a, b, c, d.api.vctx()]).size, 4);
});

test('hfields reads inputs AND selects of the view, with their keys and saved values', () => {
  const d = dom();
  d.add('e-s', { def: 'Lunch', value: 'Dinner' });
  d.add('e-c', { tag: 'SELECT', value: 'Y' });
  const f = d.api.hfields() as { key: string; value: string; def: string }[];
  assert.ok(d.sels.some((s) => s.includes('#view input') && s.includes('#view select')));
  assert.equal(
    JSON.stringify(f.map((x) => [x.key, x.value, x.def])),
    JSON.stringify([
      ['e-s', 'Dinner', 'Lunch'],
      ['e-c', 'Y', 'x'],
    ]),
  );
});

test('draw() puts typed values back after the rebuild, but only on the same screen', () => {
  const d = dom();
  const e = d.add('e-s', { def: 'Lunch' });
  d.api.draw(); // first paint records the screen
  e.value = 'Dinner';
  d.api.draw();
  assert.equal(e.value, 'Dinner', 'same screen: kept');
  e.value = 'Dinner';
  d.api.go('bud', 0, 0); // a navigation, then a redraw
  d.api.draw();
  assert.equal(e.value, 'Lunch', 'other screen: not carried over');
});

test('draw(1) is a fresh redraw: nothing is carried over', () => {
  const d = dom();
  const e = d.add('e-s', { def: 'Lunch' });
  d.api.draw();
  e.value = 'Dinner';
  d.api.draw(1);
  assert.equal(e.value, 'Lunch');
});

test('draw() does not carry values across Edit mode or a different open entry', () => {
  const d = dom();
  const e = d.add('e-s', { def: 'Lunch' });
  d.api.draw();
  for (const [ed, em] of [
    [5, 0],
    [0, 1],
  ]) {
    e.value = 'Dinner';
    d.api.go('tx', ed, em);
    d.api.draw();
    assert.equal(e.value, 'Lunch', `ed=${ed} em=${em}`);
    d.api.go('tx', 0, 0);
    d.api.draw();
  }
});

test('draw() records the new screen for the next redraw', () => {
  const d = dom();
  d.add('e-s', { def: 'Lunch' });
  d.api.draw();
  assert.equal(d.api.ctx(), 'tx|0|0');
  d.api.go('bud', 0, 0);
  d.api.draw();
  assert.equal(d.api.ctx(), 'bud|0|0');
});

// ---- addPending run for real: the guard Save adds what was typed, and says what is wrong ----
function pending(boxes: Record<string, string>, catErr = '') {
  const els: Record<string, { value: string }> = {};
  for (const [k, v] of Object.entries(boxes)) els[k] = { value: v };
  const added: string[][] = [];
  const g = {
    $: (s: string) => els[s.slice(1)] ?? null,
    LIM: { clip: (s: string) => s, LIMITS: { ACCT: 40 } },
    S: { accts: ['Cash'] },
    TOAST: { FAIL: 'FAIL' },
    STORE_OK: true,
    save: () => true,
    catAdd: (n: string, t: string, k: string) => {
      added.push([n, t, k]);
      return catErr;
    },
  };
  const ctx = vm.createContext(g);
  vm.runInContext(`${fnSrc('addAcct')};${fnSrc('addPending')};this.run=addPending`, ctx);
  return { run: (ctx as Obj).run as () => string, els, added, S: g.S };
}

test('addPending adds a typed account and category and empties the boxes', () => {
  const p = pending({ na: 'Wallet X', 'nc-n-expense': 'Pets', 'nc-k-expense': 'vet', 'nc-n-income': '', 'nc-k-income': '' });
  assert.equal(p.run(), '');
  assert.equal(p.S.accts.join(), 'Cash,Wallet X');
  assert.equal(JSON.stringify(p.added), JSON.stringify([['Pets', 'expense', 'vet']]));
  assert.equal(p.els.na.value + p.els['nc-n-expense'].value + p.els['nc-k-expense'].value, '');
});

test('addPending reports a duplicate account or category instead of dropping it', () => {
  assert.match(pending({ na: 'cash' }).run(), /already used/);
  const p = pending({ 'nc-n-income': 'Salary', 'nc-k-income': '', 'nc-n-expense': '', 'nc-k-expense': '' }, 'That name is already used.');
  assert.match(p.run(), /already used/);
  assert.equal(p.els['nc-n-income'].value, 'Salary', 'box kept so the user can fix it');
});

test('addPending with nothing typed does nothing', () => {
  assert.equal(pending({ na: '  ', 'nc-n-income': '', 'nc-k-income': '', 'nc-n-expense': '', 'nc-k-expense': '' }).run(), '');
});
