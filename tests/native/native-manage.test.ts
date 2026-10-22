import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCOUNT_TYPES,
  validateAccount,
  validateCategory,
  manageError,
  deleteWarning,
  type ExistingAccount,
} from '../../native/src/manageLogic.ts';

const accts: ExistingAccount[] = [
  { id: 'a', name: 'Cash', short_name: null },
  { id: 'b', name: 'GCash', short_name: 'gc' },
];
const draft = (o: Partial<{ name: string; type: string; short: string; opening: string }> = {}) => ({
  name: 'BPI',
  type: 'bank',
  short: '',
  opening: '',
  ...o,
});

test('account: a normal form is accepted and trimmed', () => {
  const r = validateAccount(draft({ name: '  BPI  ', short: ' bp ', opening: '1,500.50' }), accts, null);
  assert.ok(r.ok);
  assert.deepEqual(r.value, { name: 'BPI', account_type: 'bank', short_name: 'bp', opening_balance_minor: 150050 });
});

test('account: an empty opening balance means 0 and an empty short name means none', () => {
  const r = validateAccount(draft(), accts, null);
  assert.ok(r.ok);
  assert.equal(r.value.opening_balance_minor, 0);
  assert.equal(r.value.short_name, null);
});

test('account: name must be 1 to 40 characters', () => {
  const none = validateAccount(draft({ name: '   ' }), accts, null);
  assert.ok(!none.ok && /name/i.test(none.message));
  assert.ok(validateAccount(draft({ name: 'x'.repeat(40) }), accts, null).ok);
  const long = validateAccount(draft({ name: 'x'.repeat(41) }), accts, null);
  assert.ok(!long.ok && /40/.test(long.message));
});

test('account: duplicate names are caught ignoring case, except the account being edited', () => {
  const dup = validateAccount(draft({ name: 'gcash' }), accts, null);
  assert.ok(!dup.ok && /already/i.test(dup.message));
  assert.ok(validateAccount(draft({ name: 'GCASH' }), accts, 'b').ok); // renaming itself (even only the case) is fine
  assert.ok(!validateAccount(draft({ name: 'cash' }), accts, 'b').ok);
});

test('account: type must be one of the known types', () => {
  assert.deepEqual(
    ACCOUNT_TYPES.map((t) => t.id),
    ['cash', 'ewallet', 'bank', 'credit_card', 'savings', 'other'],
  );
  const r = validateAccount(draft({ type: 'crypto' }), accts, null);
  assert.ok(!r.ok && /type/i.test(r.message));
});

test('account: short name is 1 to 12 letters, numbers or spaces', () => {
  assert.ok(validateAccount(draft({ short: 'abcdefghijkl' }), accts, null).ok); // 12
  assert.ok(!validateAccount(draft({ short: 'abcdefghijklm' }), accts, null).ok); // 13
  assert.ok(!validateAccount(draft({ short: 'b-p' }), accts, null).ok);
  assert.ok(!validateAccount(draft({ short: ' x' + '☃' }), accts, null).ok);
  assert.ok(validateAccount(draft({ short: 'my bank 2' }), accts, null).ok);
});

test('account: short name must be unique and never equal another account name', () => {
  const sameShort = validateAccount(draft({ short: 'GC' }), accts, null);
  assert.ok(!sameShort.ok && /short name of another/i.test(sameShort.message));
  const sameName = validateAccount(draft({ short: 'cash' }), accts, null);
  assert.ok(!sameName.ok && /name of another/i.test(sameName.message));
  assert.ok(validateAccount(draft({ name: 'GCash', short: 'gc' }), accts, 'b').ok); // keeping its own short name
  assert.ok(validateAccount(draft({ name: 'Cash', short: 'cash' }), accts, 'a').ok); // equal to its OWN name is allowed
});

test('account: a name cannot be another account short name (quick add would be ambiguous)', () => {
  const r = validateAccount(draft({ name: 'GC' }), accts, null);
  assert.ok(!r.ok && /short name/i.test(r.message));
});

test('account: opening balance allows negatives and rejects bad text', () => {
  const neg = validateAccount(draft({ opening: '-2500.75' }), accts, null);
  assert.ok(neg.ok);
  assert.equal(neg.value.opening_balance_minor, -250075);
  for (const bad of ['abc', '12.345', '1e5', '--5', '5,00,0x']) {
    const r = validateAccount(draft({ opening: bad }), accts, null);
    assert.ok(!r.ok && /balance/i.test(r.message), bad);
  }
  assert.ok(!validateAccount(draft({ opening: '99999999999' }), accts, null).ok); // too large
});

const cats = [
  { id: 'f', name: 'Food', type: 'expense' as const },
  { id: 's', name: 'Salary', type: 'income' as const },
];

test('category: name 1 to 40 and a valid type', () => {
  const ok = validateCategory({ name: '  Pets ', type: 'expense' }, cats, null);
  assert.ok(ok.ok);
  assert.deepEqual(ok.value, { name: 'Pets', type: 'expense' });
  assert.ok(!validateCategory({ name: '', type: 'expense' }, cats, null).ok);
  assert.ok(!validateCategory({ name: 'x'.repeat(41), type: 'expense' }, cats, null).ok);
  assert.ok(validateCategory({ name: 'x'.repeat(40), type: 'income' }, cats, null).ok);
  const bad = validateCategory({ name: 'Pets', type: 'transfer' }, cats, null);
  assert.ok(!bad.ok && /income or expense/i.test(bad.message));
});

test('category: duplicates are per type and ignore case; renaming itself is fine', () => {
  const dup = validateCategory({ name: 'food', type: 'expense' }, cats, null);
  assert.ok(!dup.ok && /already/i.test(dup.message));
  assert.ok(validateCategory({ name: 'Food', type: 'income' }, cats, null).ok); // same word, other type
  assert.ok(validateCategory({ name: 'FOOD', type: 'expense' }, cats, 'f').ok);
  assert.ok(!validateCategory({ name: 'salary', type: 'income' }, cats, 'f').ok);
});

test('errors: row caps, duplicates and in-use deletes get plain messages, never raw text', () => {
  const cap = manageError({ code: 'PRLIM', message: 'Row limit reached: at most 60 accounts per user.' }, 'account', 'save');
  assert.match(cap, /60 accounts/);
  assert.match(manageError({ code: 'PRLIM', message: 'x' }, 'category', 'save'), /150 categories/);
  assert.match(manageError({ code: '23505', message: 'duplicate key value violates unique constraint' }, 'account', 'save'), /already/i);
  const used = manageError({ code: '23503', message: 'violates foreign key constraint "transactions_category_fk"' }, 'category', 'delete');
  assert.match(used, /used by entries/i);
  assert.match(used, /rename/i);
  assert.match(manageError({ code: '23503', message: 'x' }, 'account', 'delete'), /used by entries/i);
  for (const e of [{ code: '42P01', message: 'relation "accounts" does not exist' }, { message: 'JWT expired' }, {}]) {
    const m = manageError(e, 'account', 'save');
    assert.doesNotMatch(m, /relation|JWT|constraint/i);
    assert.match(m, /try again/i);
  }
  assert.equal(manageError(null, 'account', 'save'), '');
});

test('delete warning says what is kept and what is lost', () => {
  const a = deleteWarning('account', 'Cash');
  assert.match(a, /Cash/);
  assert.match(a, /starting balance/i);
  assert.match(a, /goals/i);
  const c = deleteWarning('category', 'Food');
  assert.match(c, /Food/);
  assert.match(c, /budget/i);
  assert.match(c, /entries/i);
});

test('account delete messages mention repeating entries, not only entries', () => {
  assert.match(manageError({ code: '23503', message: 'x' }, 'account', 'delete'), /repeating entries/i);
  assert.match(deleteWarning('account', 'Cash'), /repeating entries/i);
});
