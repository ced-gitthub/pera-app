import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRule, describeRule, recurringError, type RuleForm } from '../native/src/recurringLogic.ts';

const ctx = {
  accounts: [{ id: 'a' }, { id: 'b' }],
  categories: [
    { id: 'f', name: 'Food', type: 'expense' as const },
    { id: 's', name: 'Salary', type: 'income' as const },
  ],
};
const today = '2026-10-14';
const form: RuleForm = {
  id: '11111111-1111-4111-8111-111111111111',
  type: 'expense',
  amount: '15000',
  description: 'Rent',
  accountId: 'a',
  categoryId: 'f',
  frequency: 'monthly',
  interval: '1',
  start: '2026-11-01',
};
const run = (p: Partial<RuleForm>) => validateRule({ ...form, ...p }, ctx, today);
const fails = (p: Partial<RuleForm>, re: RegExp) => {
  const r = run(p);
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.message : '', re);
};

test('a valid rule becomes a row in integer centavos', () => {
  const r = run({});
  assert.ok(r.ok);
  assert.deepEqual(r.ok && r.row, {
    id: form.id,
    account_id: 'a',
    category_id: 'f',
    type: 'expense',
    amount_minor: 1500000,
    description: 'Rent',
    frequency: 'monthly',
    interval_count: 1,
    start_date: '2026-11-01',
    next_run_date: '2026-11-01',
    end_date: null,
    active: true,
  });
});

test('amount: centavos, commas, and hard limits', () => {
  const r = run({ amount: '1,499.50' });
  assert.ok(r.ok && r.row.amount_minor === 149950);
  fails({ amount: '' }, /amount/i);
  fails({ amount: '0' }, /amount/i);
  fails({ amount: '-5' }, /amount/i);
  fails({ amount: '12.345' }, /amount/i);
  fails({ amount: 'abc' }, /amount/i);
  fails({ amount: '1000000000' }, /amount/i);
  assert.ok(run({ amount: '999999999.99' }).ok);
});

test('interval: whole number 1 to 365, empty means 1', () => {
  assert.ok(run({ interval: '' }).ok);
  const r = run({ interval: '365' });
  assert.ok(r.ok && r.row.interval_count === 365);
  fails({ interval: '0' }, /1 to 365/);
  fails({ interval: '366' }, /1 to 365/);
  fails({ interval: '1.5' }, /1 to 365/);
  fails({ interval: '-2' }, /1 to 365/);
  fails({ interval: 'x' }, /1 to 365/);
});

test('start date: real date within 2 years of today', () => {
  assert.ok(run({ start: '2024-10-15' }).ok);
  assert.ok(run({ start: '2028-10-13' }).ok);
  fails({ start: '2024-10-13' }, /2 years/);
  fails({ start: '2028-10-14' }, /2 years/);
  fails({ start: '2026-02-30' }, /date/i);
  fails({ start: '' }, /date/i);
  fails({ start: '10/01/2026' }, /date/i);
});

test('category must exist and match the type; account must exist', () => {
  fails({ categoryId: 's' }, /category/i); // income category on an expense rule
  fails({ categoryId: 'zzz' }, /category/i);
  fails({ categoryId: '' }, /category/i);
  fails({ accountId: 'zzz' }, /account/i);
  fails({ accountId: '' }, /account/i);
  const r = run({ type: 'income', categoryId: 's', description: 'Pay' });
  assert.ok(r.ok && r.row.type === 'income' && r.row.category_id === 's');
  fails({ type: 'income' }, /category/i); // expense category on an income rule
});

test('frequency must be one of the four', () => {
  for (const f of ['daily', 'weekly', 'monthly', 'yearly'] as const) assert.ok(run({ frequency: f }).ok);
  fails({ frequency: 'hourly' as never }, /how often/i);
});

test('description is trimmed, optional and capped at 120', () => {
  const r = run({ description: '  Netflix  ' });
  assert.ok(r.ok && r.row.description === 'Netflix');
  assert.ok(run({ description: '' }).ok);
  assert.ok(run({ description: 'x'.repeat(120) }).ok);
  fails({ description: 'x'.repeat(121) }, /120/);
});

test('describeRule reads like a sentence', () => {
  const d = (frequency: string, interval_count: number, end_date: string | null = null) =>
    describeRule({ frequency, interval_count, start_date: '2026-10-01', end_date });
  assert.equal(d('monthly', 1), 'Every month from 2026-10-01');
  assert.equal(d('daily', 1), 'Every day from 2026-10-01');
  assert.equal(d('weekly', 2), 'Every 2 weeks from 2026-10-01');
  assert.equal(d('yearly', 1), 'Every year from 2026-10-01');
  assert.equal(d('daily', 3), 'Every 3 days from 2026-10-01');
  assert.equal(d('monthly', 1, '2027-03-01'), 'Every month from 2026-10-01 until 2027-03-01');
});

test('errors: row cap and duplicates get clear words, never raw database text', () => {
  assert.equal(recurringError(null), null);
  assert.equal(
    recurringError({ message: 'Row limit reached: at most 100 recurring transactions per user.', code: 'PRLIM' }),
    'You can have at most 100 recurring rules. Delete one to add another.',
  );
  assert.equal(recurringError({ message: 'x PRLIM y' }), 'You can have at most 100 recurring rules. Delete one to add another.');
  const other = recurringError({ message: 'duplicate key value violates constraint "recurring_pkey"', code: 'XX000' }) ?? '';
  assert.match(other, /try again/i);
  assert.doesNotMatch(other, /constraint|violates|recurring_pkey/);
});
