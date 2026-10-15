// QA reject of f7ed2b4: the tour, addAcct and Keep/Clear wiring run for real in a vm (no source-text matching).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { HTML, slice, type St } from './artifact-undo-kit.ts';

const fnSrc = (name: string) => {
  const a = HTML.indexOf(`function ${name}(`);
  assert.ok(a >= 0, name);
  const b = HTML.indexOf('\nfunction ', a + 5);
  const c = HTML.indexOf('\nconst ', a + 5);
  return HTML.slice(a, Math.min(...[b, c].filter((x) => x > 0)));
};

// ---- tourStep / tourGo ----
function tour(v: string) {
  const log: string[] = [];
  const pending: (() => void)[] = [];
  const g = {
    $: () => null,
    document: { querySelectorAll: () => [] },
    draw: () => void log.push('draw'),
    tourDraw: () => void log.push('tourDraw'),
    gnav: (fn: () => void) => {
      log.push('gnav');
      pending.push(fn);
    },
    log,
  };
  const ctx = vm.createContext(g);
  vm.runInContext(
    `${slice('INTROCORE')};let S={v:${JSON.stringify(v)}},TOUR=-1,EM=1,ED=3,CF='x';
     function tourEnd(){TOUR=-1;log.push('end')}
     ${fnSrc('tourGo')};${fnSrc('tourStep')};
     this.api={tourStep,tourGo,INTRO,st:()=>({v:S.v,TOUR,EM,ED,CF})}`,
    ctx,
  );
  return { api: (ctx as St).api as St, log, pending };
}

test('tourStep(-1) (Done on the last step) ends the tour and does not throw', () => {
  const t = tour('home');
  assert.doesNotThrow(() => t.api.tourStep(-1));
  assert.deepEqual(t.log, ['end']);
  assert.equal(t.api.INTRO.next(t.api.INTRO.steps().length - 1), -1, 'Done is -1');
});

test('tourStep to another tab asks the unsaved guard first; the move happens only when it lets go', () => {
  const t = tour('home');
  const other = t.api.INTRO.steps().findIndex((s: St) => s.tab !== 'home');
  assert.ok(other >= 0);
  t.api.tourStep(other);
  assert.deepEqual(t.log, ['gnav'], 'guarded');
  assert.equal(t.api.st().v, 'home', 'not moved yet');
  t.pending[0]();
  assert.notEqual(t.api.st().v, 'home', 'moved after the guard allows it');
});

test('tourStep on the same tab moves straight on, no guard', () => {
  const t = tour('home');
  const same = t.api.INTRO.steps().findIndex((s: St) => s.tab === 'home');
  assert.ok(same >= 0);
  t.api.tourStep(same);
  assert.ok(!t.log.includes('gnav'));
  assert.equal(t.api.st().TOUR, same);
});

test('tourGo to another tab changes S.v, resets Edit/open entry/confirm, and redraws the screen', () => {
  const t = tour('home');
  const i = t.api.INTRO.steps().findIndex((s: St) => s.tab !== 'home');
  const tab = t.api.INTRO.steps()[i].tab;
  t.api.tourGo(i);
  assert.equal(JSON.stringify(t.api.st()), JSON.stringify({ v: tab, TOUR: i, EM: 0, ED: 0, CF: '' }));
  assert.deepEqual(t.log, ['draw', 'tourDraw'], 'screen redrawn before the tour card');
});

test('tourGo on the same tab does not redraw the screen', () => {
  const t = tour('home');
  t.api.tourGo(t.api.INTRO.steps().findIndex((s: St) => s.tab === 'home'));
  assert.deepEqual(t.log, ['tourDraw']);
});

// ---- addAcct ----
function acct(name: string, o: { saveOk?: boolean; accts?: string[] } = {}) {
  const box = { value: name };
  const g = {
    $: (s: string) => (s === '#na' ? box : null),
    LIM: { clip: (s: string) => s, LIMITS: { ACCT: 40 } },
    TOAST: { FAIL: 'Not saved: could not write to this device. Try again.' },
    STORE_OK: true,
    save: () => o.saveOk !== false,
    S: { accts: o.accts ?? ['Cash'] },
  };
  const ctx = vm.createContext(g);
  vm.runInContext(`${fnSrc('addAcct')};this.run=addAcct`, ctx);
  return { run: (ctx as St).run as (f?: number) => string, box, S: g.S, g };
}

test('addAcct(force): an empty name says "Enter a name." only when forced (the Add button), silent otherwise', () => {
  assert.equal(acct('  ').run(1), 'Enter a name.');
  assert.equal(acct('  ').run(), '');
  assert.equal(acct('  ').run(0), '');
});

test('addAcct: a failed save puts the account list back and keeps the typed name', () => {
  const a = acct('Wallet', { saveOk: false });
  assert.equal(a.run(1), a.g.TOAST.FAIL);
  assert.deepEqual(a.S.accts, ['Cash'], 'rolled back');
  assert.equal(a.box.value, 'Wallet', 'name kept so the user can retry');
});

test('addAcct: a good save adds the account and empties the box', () => {
  const a = acct('Wallet');
  assert.equal(a.run(1), '');
  assert.deepEqual(a.S.accts, ['Cash', 'Wallet']);
  assert.equal(a.box.value, '');
});

// ---- addPending: a keyword typed without a category name is reported ----
test('addPending: a keyword with no category name is sent to catAdd and its error is shown', () => {
  const els: Record<string, { value: string }> = {
    na: { value: '' },
    'nc-n-income': { value: '' },
    'nc-k-income': { value: '' },
    'nc-n-expense': { value: '' },
    'nc-k-expense': { value: 'vet' },
  };
  const g = {
    $: (s: string) => els[s.slice(1)] ?? null,
    LIM: { clip: (s: string) => s, LIMITS: { ACCT: 40 } },
    S: { accts: [] as string[] },
    catAdd: (n: string) => (n.trim() ? '' : 'Enter a name.'),
    STORE_OK: true,
    save: () => true,
    TOAST: { FAIL: 'F' },
  };
  const ctx = vm.createContext(g);
  vm.runInContext(`${fnSrc('addAcct')};${fnSrc('addPending')};this.run=addPending`, ctx);
  assert.equal(((ctx as St).run as () => string)(), 'Enter a name.');
  assert.equal(els['nc-k-expense'].value, 'vet', 'keyword kept');
});

// ---- Keep/Clear card "Clear" opens Settings in a clean state ----
test('kcc opens Settings, saves the screen, leaves Edit mode and shows the Clear panel', () => {
  const m = HTML.match(/else if\(a=='kcc'\)(\{[^\n]*\})/);
  assert.ok(m, 'kcc handler');
  const calls: string[] = [];
  const g = {
    save: () => void calls.push('save'),
    draw: () => void calls.push('draw'),
    $: () => null,
    calls,
  };
  const ctx = vm.createContext(g);
  vm.runInContext(
    `let S={v:'home'},EM=1,ED=4,CF='',CLRT='old',CLRRES={ok:1};const a='kcc';
     if(a=='kcc')${m[1]};
     this.st=()=>({v:S.v,EM,ED,CF,CLRT,CLRRES})`,
    ctx,
  );
  assert.equal(JSON.stringify((ctx as St).st()), JSON.stringify({ v: 'set', EM: 0, ED: 0, CF: 'clr', CLRT: '', CLRRES: null }));
  assert.deepEqual(calls, ['save', 'draw'], 'saved before the redraw');
});
