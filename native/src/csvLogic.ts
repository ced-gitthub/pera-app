// Pure CSV logic (no React Native, no network): build the export text, check and map pasted text into rows to insert. Uses the website's own parser (src/core/io.ts),
// so a file exported from the website imports here and the other way round. Money stays integer centavos the whole way.
import { csvParse, fromCsv, toCsv, type Row } from '../../src/core/io.ts';
import { isDate, isSaneDate, manilaToday, parseAmountMinor } from '../../src/core/money.ts';
import type { Snapshot } from './logic';

export const MAX_IMPORT_ROWS = 5000; // per paste; keeps one import to ten small batches
export const MAX_CSV_CHARS = 900_000; // same size limit as the website
export const MAX_EXPORT_ROWS = 50_000; // the database allows 50,000 entries per person, so this never cuts anything off
export const PAGE_SIZE = 1000;
export const BATCH_SIZE = 500;
export const MAX_SHOWN_PROBLEMS = 10;

// ---- export
export type ExportTx = {
  type: 'income' | 'expense' | 'transfer';
  amount_minor: number;
  transaction_date: string;
  description: string;
  notes: string;
  category_id: string | null;
  account_id: string | null;
  transfer_account_id: string | null;
};

export function buildExport(txs: ExportTx[], s: Snapshot): { text: string; count: number } {
  const an = new Map(s.accounts.map((a) => [a.id, a.name]));
  const cn = new Map(s.categories.map((c) => [c.id, c.name]));
  const rows: Row[] = txs.map((x) => ({
    date: x.transaction_date,
    type: x.type,
    amount_minor: Number(x.amount_minor),
    category: x.type === 'transfer' ? 'Transfer' : ((x.category_id && cn.get(x.category_id)) ?? 'Other'),
    description: x.description ?? '',
    notes: x.notes ?? '',
    account: (x.account_id && an.get(x.account_id)) || '',
    to_account: (x.transfer_account_id && an.get(x.transfer_account_id)) || '',
  }));
  return { text: toCsv(rows), count: rows.length };
}

// ---- import
export type RowProblem = { row: number; message: string }; // row = the Nth entry after the header line
export type DbRow = {
  type: 'income' | 'expense' | 'transfer';
  amount_minor: number;
  account_id: string;
  transfer_account_id: string | null;
  category_id: string | null;
  description: string;
  notes: string;
  transaction_date: string;
  import_hash: string;
};
export type ImportPlan = {
  blocked: string | null; // a reason nothing can be imported at all
  total: number; // entries found in the pasted text
  rows: DbRow[]; // ready to add (already-imported rows and problem rows are left out)
  hashes: string[]; // import_hash of every row that could be mapped, for looking up earlier imports
  dup: number; // rows left out because an earlier import already has them
  problems: RowProblem[];
  range: { from: string; to: string } | null; // first and last date among mappable rows
};

const empty = (blocked: string | null, total = 0, problems: RowProblem[] = []): ImportPlan => ({
  blocked,
  total,
  rows: [],
  hashes: [],
  dup: 0,
  problems,
  range: null,
});
const n = (x: number) => x.toLocaleString('en-US');

// Why a row that the shared parser rejected was rejected, in words a person can fix.
function whyBad(c: string[]): string {
  if (!isDate((c[0] ?? '').trim())) return 'Date must be a real date like 2026-10-14.';
  if (!['income', 'expense', 'transfer'].includes((c[1] ?? '').toLowerCase())) return 'Type must be income, expense or transfer.';
  if (parseAmountMinor(c[2] ?? '') === null) return 'Amount must be 0.01 to 999,999,999.99, with at most 2 decimals (like 1250.50).';
  return 'This row could not be read. Use: date, type, amount, category, description, notes, account, to_account.';
}

export function planImport(text: string, s: Snapshot, existing: Set<string> = new Set(), today = manilaToday()): ImportPlan {
  if (!text.trim()) return empty('Paste your CSV text first.');
  if (text.length > MAX_CSV_CHARS)
    return empty(
      `That text is too large (max ${n(MAX_CSV_CHARS)} characters, roughly 9,000 rows). Split it into smaller parts and import them one by one.`,
    );
  const parsed = csvParse(text);
  const hasHeader = parsed.length > 0 && /date/i.test(parsed[0][0] ?? '');
  const cells = hasHeader ? parsed.slice(1) : parsed;
  const total = cells.length;
  if (total === 0) return empty('No rows found under the header line.');
  if (total > MAX_IMPORT_ROWS)
    return empty(
      `Too many rows (${n(total)}). The limit is ${n(MAX_IMPORT_ROWS)} per import. Split the file and import it in parts.`,
      total,
    );

  const r = fromCsv(text, new Set(), {
    income: s.categories.filter((c) => c.type === 'income').map((c) => c.name),
    expense: s.categories.filter((c) => c.type === 'expense').map((c) => c.name),
  });
  const problems: RowProblem[] = r.bad.map((row) => ({ row, message: whyBad(cells[row - 1] ?? []) }));
  const bad = new Set(r.bad);
  const goodNums: number[] = [];
  for (let i = 1; i <= total; i++) if (!bad.has(i)) goodNums.push(i);

  const byName = new Map<string, string>();
  for (const a of s.accounts) {
    byName.set(a.name.toLowerCase(), a.id);
    if (a.short_name && !byName.has(a.short_name.toLowerCase())) byName.set(a.short_name.toLowerCase(), a.id);
  }
  const def = (s.accounts.find((a) => a.name.toLowerCase() === 'cash') ?? s.accounts[0])?.id;
  const rows: DbRow[] = [];
  const hashes: string[] = [];
  const dates: string[] = [];
  let dup = 0;
  r.ok.forEach((x, i) => {
    const row = goodNums[i];
    const fail = (message: string) => problems.push({ row, message });
    if (!isSaneDate(x.date, today))
      return fail(`Date ${x.date} is out of range. Use a date between the year 2000 and five years from now.`);
    let account_id: string | undefined;
    if (x.account) {
      account_id = byName.get(x.account.toLowerCase());
      if (!account_id) return fail(`Unknown account "${x.account}". Use one of your account names, or add the account first.`);
    } else {
      account_id = def;
      if (!account_id) return fail('You have no accounts yet. Add an account first.');
    }
    let transfer_account_id: string | null = null;
    let category_id: string | null = null;
    if (x.type === 'transfer') {
      if (!x.to_account) return fail('A transfer needs a to_account: the account the money goes to.');
      const to = byName.get(x.to_account.toLowerCase());
      if (!to) return fail(`Unknown account "${x.to_account}" in to_account. Use one of your account names, or add the account first.`);
      if (to === account_id) return fail('A transfer needs two different accounts.');
      transfer_account_id = to;
    } else {
      const cat =
        s.categories.find((c) => c.type === x.type && c.name === x.category) ??
        s.categories.find((c) => c.type === x.type && c.name === (x.type === 'income' ? 'Other Income' : 'Other'));
      if (!cat) return fail(`Category "${x.category}" does not exist for ${x.type}. Add it first, or add an "Other" category.`);
      category_id = cat.id;
    }
    hashes.push(x.import_hash);
    dates.push(x.date);
    if (existing.has(x.import_hash)) {
      dup++;
      return;
    }
    rows.push({
      type: x.type,
      amount_minor: x.amount_minor,
      account_id,
      transfer_account_id,
      category_id,
      description: x.description,
      notes: x.notes,
      transaction_date: x.date,
      import_hash: x.import_hash,
    });
  });
  problems.sort((a, b) => a.row - b.row);
  dates.sort(); // the lookup range covers rows left out as duplicates too
  const range = dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null;
  return { blocked: null, total, rows, hashes, dup, problems, range };
}

export function problemLines(ps: RowProblem[], limit = MAX_SHOWN_PROBLEMS): string[] {
  const lines = ps.slice(0, limit).map((p) => `Row ${p.row}: ${p.message}`);
  if (ps.length > limit) lines.push(`...and ${n(ps.length - limit)} more`);
  return lines;
}

// What the person reads after Check: counts first, so they know what Import will do.
export function checkSummary(p: ImportPlan): string {
  if (p.blocked) return p.blocked;
  const parts = [`${n(p.rows.length)} ready to add`];
  if (p.dup) parts.push(`${n(p.dup)} already imported`);
  if (p.problems.length) parts.push(`${n(p.problems.length)} with problems`);
  return `${parts.join(', ')} (${n(p.total)} rows found).`;
}

export type ImportResult = { added: number; dup: number; problems: number; error: string | null };
export function importMessage(r: ImportResult): string {
  const base = `${n(r.added)} added, ${n(r.dup)} skipped as ${r.dup === 1 ? 'duplicate' : 'duplicates'}, ${n(r.problems)} ${
    r.problems === 1 ? 'row with a problem' : 'rows with problems'
  }.`;
  return r.error ? `Stopped early. ${base} ${r.error}` : base;
}

// Never the raw database text.
export function importError(error: { message: string; code?: string } | null): string {
  if (error && (error.code === 'PRLIM' || /PRLIM/.test(error.message)))
    return 'You have reached the limit of 50,000 entries, so no more can be added. Delete old entries to make room.';
  return 'The server refused part of the file or could not be reached. Check your connection and try again; nothing is added twice.';
}
