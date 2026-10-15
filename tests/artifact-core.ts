// Shared by tests/artifact-csv.test.ts and tests/artifact-export.test.ts: loads the CSVCORE block of the artifact and the native logic to compare it with.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { checkSummary, planImport, problemLines } from '../native/src/csvLogic.ts';
import type { Snapshot } from '../native/src/logic.ts';

export const HTML = fs.readFileSync('artifact/pera-artifact.html', 'utf8');
export const block = (name: string) => {
  const a = HTML.indexOf(`/*${name}:BEGIN*/`);
  const b = HTML.indexOf(`/*${name}:END*/`);
  assert.ok(a >= 0 && b > a, `${name} markers missing`);
  return HTML.slice(a, b);
};
export type Plan = {
  blocked: string | null;
  total: number;
  rows: {
    date: string;
    type: string;
    amount_minor: number;
    cat: string;
    desc: string;
    notes: string;
    acct: string;
    to: string;
    ih: string;
  }[];
  hashes: string[];
  dup: number;
  problems: { row: number; message: string }[];
  range: { from: string; to: string } | null;
};
export type Csv = {
  plan(t: string, ctx: unknown, ex: Set<string>, today: string): Plan;
  exportRun(tx: unknown[], f: string, t: string, today: string): { ok: boolean; count?: number; text?: string; message: string };
  exportRange(f: string, t: string, today: string): { ok: boolean; message?: string };
  amtMinor(s: string): number | null;
  ihNorm(k: string): string;
  roomMsg(have: number, add: number): string | null;
  checkSummary(p: Plan): string;
  importMessage(r: { added: number; dup: number; problems: number }): string;
  problemLines(p: { row: number; message: string }[]): string[];
  normalize(t: string): string;
  MAXC: number;
  MAXR: number;
  MAXX: number;
};
const raw = vm.runInNewContext(block('CSVCORE') + ';CSV') as Csv;
// Values made inside the sandbox have the sandbox's Array/Object, which deepEqual treats as different; copy plain data into this realm.
export const J = <T>(x: T): T => JSON.parse(JSON.stringify(x));
export const CSV: Csv = {
  ...raw,
  plan: (t, c, e, d) => J(raw.plan(t, c, e, d)),
  exportRun: (tx, f, t, d) => J(raw.exportRun(tx, f, t, d)),
  problemLines: (p) => J(raw.problemLines(p)),
};

const acct = (id: string, name: string, short: string | null = null) => ({
  id,
  name,
  short_name: short,
  counts_as_savings: false,
  opening_balance_minor: 0,
  show_on_home: true,
});
export const snap: Snapshot = {
  accounts: [acct('a', 'Cash'), acct('b', 'GCash', 'gc'), acct('c', 'BDO Savings')],
  categories: [
    { id: 'f', name: 'Food', type: 'expense' },
    { id: 'tr', name: 'Transportation', type: 'expense' },
    { id: 'o', name: 'Other', type: 'expense' },
    { id: 's', name: 'Salary', type: 'income' },
    { id: 'g', name: 'Gift', type: 'income' },
    { id: 'oi', name: 'Other Income', type: 'income' },
  ],
  balances: {},
  recent: [],
  dates: [],
  totalEntries: 0,
  noAccount: 0,
};
export const TODAY = '2026-10-14';
export const ctx = {
  accts: ['Cash', 'GCash', 'BDO Savings'],
  alias: { GCash: ['gc'] },
  inc: ['Salary', 'Gift', 'Other Income'],
  exp: ['Food', 'Transportation', 'Other'],
};
const aname = new Map(snap.accounts.map((a) => [a.id, a.name]));
const cname = new Map(snap.categories.map((c) => [c.id, c.name]));

// Native plan, with ids turned into names so both sides can be compared.
export function nativeView(text: string, existing = new Set<string>()) {
  const p = planImport(text, snap, existing, TODAY);
  return {
    blocked: p.blocked,
    total: p.total,
    dup: p.dup,
    problems: p.problems,
    range: p.range,
    hashes: p.hashes,
    summary: checkSummary(p),
    lines: problemLines(p.problems),
    rows: p.rows.map((r) => ({
      date: r.transaction_date,
      type: r.type,
      amount_minor: r.amount_minor,
      cat: r.category_id ? cname.get(r.category_id) : 'Transfer',
      desc: r.description,
      notes: r.notes,
      acct: aname.get(r.account_id),
      to: r.transfer_account_id ? aname.get(r.transfer_account_id) : '',
      ih: r.import_hash,
    })),
  };
}
export function artView(text: string, existing = new Set<string>()) {
  const p = CSV.plan(text, ctx, existing, TODAY);
  return {
    blocked: p.blocked,
    total: p.total,
    dup: p.dup,
    problems: p.problems,
    range: p.range,
    hashes: p.hashes,
    summary: CSV.checkSummary(p),
    lines: CSV.problemLines(p.problems),
    rows: p.rows.map((r) => ({ ...r })),
  };
}
// The hash is stored in a different spelling by design (centavos, 0-based), so rows are compared with it left out, and hashes on their own.
export const noHash = (v: ReturnType<typeof artView>) => ({ ...v, hashes: undefined, rows: v.rows.map((r) => ({ ...r, ih: undefined })) });
