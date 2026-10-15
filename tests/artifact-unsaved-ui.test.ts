// Item 4 wiring: every way out of a changed form goes through the guard, and the sheet is accessible.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HTML } from './artifact-undo-kit.ts';

const line = (re: RegExp) => HTML.match(re)?.[0] ?? '';
const handler = (a: string) => line(new RegExp(`else if\\(a=='${a}'\\)[^\\n]*`));

test('AC-36 every exit goes through gnav: tab change, Cancel, another row, Done', () => {
  assert.ok(/ if\(a=='v'\)\{gnav\(/.test(HTML), 'tab change');
  assert.ok(handler('cx').includes('gnav('), 'Cancel on an entry');
  assert.ok(handler('ed').includes('gnav('), 'Edit on another row');
  assert.ok(/else if\(a=='em'\)\{if\(EM\)\{gnav\(/.test(HTML), 'Done in Edit mode');
});

test('AC-36 the sheet decision buttons are handled before any other action', () => {
  const click = HTML.slice(HTML.indexOf("document.addEventListener('click'"));
  const us = click.indexOf("a.slice(0,3)=='us-'");
  const first = click.indexOf("if(EM&&['cm'");
  assert.ok(us > 0 && us < first, 'us- actions come first');
  assert.ok(click.includes('GU.choose(a.slice(3))'));
});

test('AC-37 Esc on an open sheet means Keep editing; Esc on a changed editor asks', () => {
  const k = HTML.slice(HTML.indexOf("e.key=='Escape'"));
  assert.ok(k.startsWith("e.key=='Escape'"));
  assert.ok(/GU\.open\(\)\)\{GU\.choose\('keep'\)/.test(k.slice(0, 200)));
  assert.ok(/if\(ED\)GU\.nav\(/.test(k.slice(0, 300)));
});

test('AC-40 the sheet is a labelled alert dialog, focus starts on Keep editing, buttons in native order', () => {
  const s = HTML.slice(HTML.indexOf('function showUS'), HTML.indexOf('function hideUS'));
  assert.ok(s.includes('role="alertdialog"') && s.includes('aria-modal="true"'));
  assert.ok(s.includes('aria-labelledby="us-t"') && s.includes('aria-describedby="us-d"'));
  assert.ok(s.includes('UNSAVED.TITLE') && s.includes('UNSAVED.TEXT'));
  const k = s.indexOf('data-a="us-keep" id="us-k"');
  const d = s.indexOf('data-a="us-discard"');
  const v = s.indexOf('data-a="us-save"');
  assert.ok(k > 0 && d > k && v > d, 'Keep editing, Discard, Save');
  assert.ok(s.includes("$('#us-k').focus()"));
  assert.ok(HTML.includes("e.key=='Tab'&&GU.open()"), 'focus is kept inside the sheet');
});

test('AC-40 the sheet is stacked and thumb-sized on a phone', () => {
  assert.ok(/#us\{position:fixed;inset:0;z-index:30/.test(HTML));
  assert.ok(/\.usbt\{display:flex;flex-direction:column/.test(HTML));
  assert.ok(/\.usbt button\{width:100%/.test(HTML));
});

test('AC-35 what counts as a change: every editable field, with the right save and discard', () => {
  const f = HTML.slice(HTML.indexOf('const MONEYSEL'), HTML.indexOf('function showUS'));
  for (const w of ['#e-a', 'ED', 'saveEntry(', 'addRule(', 'commitTab()', 'commitImport()', 'IBOX', 'IIMP']) assert.ok(f.includes(w), w);
  assert.ok(f.includes('.ao') && f.includes('.cb') && f.includes('#r-a'), 'money fields are normalised');
  assert.ok(!f.includes('parseFloat'), 'no float math');
});

test('AC-35 CSV paste counts as unsaved until it is imported or edited again', () => {
  assert.ok(handler('impgo').includes('IIMP='), 'import marks it done');
  assert.ok(/id=='csv'\)\{IBOX=e\.target\.value;IIMP=false/.test(HTML), 'typing again makes it unsaved again');
});

test('AC-35 saving an entry or a rule is its own function that says whether it worked', () => {
  assert.ok(/function saveEntry\(id\)\{[\s\S]*?return true\}/.test(HTML));
  assert.ok(/function addRule\(\)\{[\s\S]*?return true\}/.test(HTML));
  assert.ok(handler('ok').includes('saveEntry('));
  assert.ok(handler('rra').includes('addRule()'));
});

test('closing the browser tab with changes asks the browser to confirm', () => {
  const b = HTML.slice(HTML.indexOf("addEventListener('beforeunload'"));
  assert.ok(b.includes('e.preventDefault()') && b.slice(0, 400).includes('curForm()'));
});
