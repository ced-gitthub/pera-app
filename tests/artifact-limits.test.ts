// Item 6: limits and exact amount/date parsing. No parseFloat on typed text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { HTML, slice, J } from './artifact-undo-kit.ts';

type R = { ok: boolean; minor?: number; pesos?: number; message?: string; why?: string; date?: string; empty?: boolean };
type Lim = {
  LIMITS: Record<string, number>;
  MSG: Record<string, string>;
  clip(s: unknown, n: number): string;
  parseAmount(s: string): R;
  parseBudget(s: string): R;
  parseOpening(s: string): R;
  parseDate(s: string, today: string): R;
  quickAmount(n: string, k?: string | boolean): R;
  negate(s: string): string;
};
const LIM = vm.runInNewContext(`${slice('CSVCORE')};${slice('LIMITSCORE')};LIM`) as Lim;
const TODAY = '2026-10-15';

test('limits: description 120, notes 500, account 40, category 30, quick-add 500', () => {
  assert.deepEqual(J(LIM.LIMITS), { DESC: 120, NOTES: 500, ACCT: 40, CAT: 30, QUICK: 500 });
  assert.equal(LIM.clip('x'.repeat(900), 120).length, 120);
  assert.equal(LIM.clip(null, 5), '');
});

test('limits: exact messages', () => {
  assert.equal(LIM.MSG.AMOUNT, 'Amount must be 0.01 to 999,999,999.99, with at most 2 decimals.');
  assert.equal(LIM.MSG.DATE, 'Use a real date like 2026-10-14 (between the year 2000 and five years from now).');
  assert.equal(LIM.MSG.BUDGET, 'Type the monthly limit as a number above 0, like 3000.');
  assert.equal(LIM.MSG.OPENING, 'The starting balance is not a valid amount. Use numbers like 1500 or -250.50, or leave it empty for 0.');
});

test('parseAmount: integer centavos, 2 decimals max, range', () => {
  assert.deepEqual(J(LIM.parseAmount('1,234.50')), { ok: true, minor: 123450, pesos: 1234.5 });
  assert.equal(LIM.parseAmount('0.01').minor, 1);
  assert.equal(LIM.parseAmount('999999999.99').minor, 99999999999);
  for (const bad of ['', 'abc', '0', '0.00', '-5', '1.005', '1e3', '1000000000', '12abc', '1.2.3'])
    assert.equal(LIM.parseAmount(bad).message, LIM.MSG.AMOUNT, bad);
  assert.equal(LIM.parseAmount('0.1').pesos, 0.1);
});

test('parseBudget: empty or zero removes, garbage is an error', () => {
  for (const e of ['', ' ', '0', '0.00']) assert.equal(LIM.parseBudget(e).empty, true, e);
  assert.equal(LIM.parseBudget('3000').pesos, 3000);
  for (const bad of ['abc', '-5', '1.234', '1000000000']) assert.equal(LIM.parseBudget(bad).message, LIM.MSG.BUDGET, bad);
});

test('parseOpening: signed, empty is 0, no negative zero', () => {
  assert.equal(LIM.parseOpening('').minor, 0);
  assert.equal(LIM.parseOpening('-250.50').minor, -25050);
  assert.equal(LIM.parseOpening('1500').pesos, 1500);
  assert.equal(Object.is(LIM.parseOpening('-0').minor, 0), true);
  for (const bad of ['abc', '1.234', '--5', '1000000000']) assert.equal(LIM.parseOpening(bad).message, LIM.MSG.OPENING, bad);
});

test('parseDate: real dates only', () => {
  assert.equal(LIM.parseDate('2026-10-14', TODAY).date, '2026-10-14');
  for (const bad of ['', '2026-02-30', '1999-01-01', '2040-01-01', 'tomorrow'])
    assert.equal(LIM.parseDate(bad, TODAY).message, LIM.MSG.DATE, bad);
});

test('quickAmount: k moves the point by string, no float drift', () => {
  assert.equal(LIM.quickAmount('1.5', 'k').minor, 150000);
  assert.equal(LIM.quickAmount('0.001', 'k').minor, 100);
  assert.equal(LIM.quickAmount('120').minor, 12000);
  assert.equal(LIM.quickAmount('1,200.50').minor, 120050);
  assert.equal(LIM.quickAmount('1.10').minor, 110);
  assert.equal(LIM.quickAmount('1.239', 'k').minor, 123900);
  assert.equal(LIM.quickAmount('0.001').why, 'dec');
  assert.equal(LIM.quickAmount('0.00').why, 'low');
  assert.equal(LIM.quickAmount('0').message, 'Amount must be at least 0.01');
  assert.equal(LIM.quickAmount('1000000000').message, 'Amount too large');
  assert.equal(LIM.quickAmount('1.234').message, LIM.MSG.AMOUNT);
  assert.equal(LIM.quickAmount('1.234').why, 'dec');
});

test('negate toggles the sign of typed text', () => {
  assert.equal(LIM.negate('100'), '-100');
  assert.equal(LIM.negate('-100.5'), '100.5');
  assert.equal(LIM.negate('abc'), 'abc');
  assert.equal(LIM.negate(''), '');
  assert.equal(LIM.negate('0'), '0');
});

test('wiring: no parseFloat anywhere, limits on inputs, text inputs for money', () => {
  assert.equal((HTML.match(/parseFloat\(/g) || []).length, 0);
  for (const id of ['e-s', 'r-s']) assert.match(HTML, new RegExp(`id="${id}"[^>]*maxlength="120"|maxlength="120"[^>]*id="${id}"`));
  for (const id of ['e-n', 'q']) assert.match(HTML, new RegExp(`id="${id}"[^>]*maxlength="500"`));
  for (const id of ['e-a', 'r-a']) assert.match(HTML, new RegExp(`id="${id}" type="text" inputmode="decimal"`));
  assert.match(HTML, /class="ao" type="text" inputmode="decimal"/);
  assert.match(HTML, /class="cb" type="text" inputmode="decimal"/);
  assert.ok(HTML.includes("LIM.clip($('#q').value,LIM.LIMITS.QUICK)"));
});

test('wiring: failure line replaces the old storage wording', () => {
  assert.ok(!HTML.includes('Could not write to storage'));
  assert.ok(HTML.includes("'could not write to this device. Try again.'"));
});

test('quickAmount edge cases: trailing zeros, leading zeros, huge, junk, padded date', () => {
  assert.equal(LIM.quickAmount('1.230').minor, 123);
  assert.equal(LIM.quickAmount('1.2300', 'k').minor, 123000);
  assert.equal(LIM.quickAmount('007').minor, 700);
  assert.equal(LIM.quickAmount('123456789012').why, 'high');
  assert.equal(LIM.quickAmount('999999999.99').minor, 99999999999);
  assert.equal(LIM.quickAmount('abc').why, 'bad');
  assert.equal(LIM.quickAmount('abc').message, LIM.MSG.AMOUNT);
  assert.equal(LIM.quickAmount('5', 'k').minor, 500000);
  assert.equal(LIM.parseDate(' 2026-10-14 ', TODAY).date, '2026-10-14');
  assert.equal(LIM.parseDate('x', TODAY).ok, false);
});
