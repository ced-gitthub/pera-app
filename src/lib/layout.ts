// Per-user layout: which blocks each tab shows, and in what order. Pure functions (no I/O) so they are unit-tested.
// Stored as JSON in user_settings.layout. Anything missing or invalid falls back to the defaults, and unknown block ids are ignored,
// so adding a block later never breaks a saved layout. Layout only decides what is DRAWN: no total is ever computed from it.
export type TabId = 'home' | 'reports' | 'accounts' | 'transactions';
export const TABS: TabId[] = ['home', 'reports', 'accounts', 'transactions'];
export type Block = { id: string; label: string; on: boolean };
export const BLOCKS: Record<TabId, Block[]> = {
  home: [
    { id: 'accounts', label: 'Accounts', on: true }, { id: 'spendable', label: 'Spendable balance', on: true }, { id: 'savings', label: 'Savings', on: true },
    { id: 'history', label: 'History', on: true }, { id: 'period', label: 'Income / Expenses / Net', on: false }, { id: 'categories', label: 'Spending by category', on: false }, { id: 'budgets', label: 'Budget progress', on: false },
  ],
  reports: [{ id: 'period', label: 'Income / Expenses / Net', on: true }, { id: 'categories', label: 'Spending by category', on: true }, { id: 'byaccount', label: 'Spending by account', on: true }, { id: 'monthly', label: 'Monthly table', on: true }],
  accounts: [{ id: 'short', label: 'Short names', on: true }, { id: 'noacct', label: '"No account" row', on: true }],
  transactions: [
    { id: 'search', label: 'Search', on: true }, { id: 'type', label: 'Type', on: true }, { id: 'category', label: 'Category', on: true }, { id: 'account', label: 'Account', on: true },
    { id: 'amount', label: 'Amount range', on: true }, { id: 'date', label: 'Date range', on: true }, { id: 'sort', label: 'Sort', on: true },
  ],
};
export const REORDERABLE: Record<TabId, boolean> = { home: true, reports: true, accounts: false, transactions: true };
export const HISTORY_SIZES = [5, 6, 10, 20], HISTORY_DEFAULT = 6;
export type TabLayout = { order: string[]; on: Record<string, boolean>; n?: number };
export type Layout = Record<TabId, TabLayout>;
export const defaultTab = (tab: TabId): TabLayout => ({ order: BLOCKS[tab].map(b => b.id), on: Object.fromEntries(BLOCKS[tab].map(b => [b.id, b.on])), ...(tab === 'home' ? { n: HISTORY_DEFAULT } : {}) });
export const defaultLayout = (): Layout => ({ home: defaultTab('home'), reports: defaultTab('reports'), accounts: defaultTab('accounts'), transactions: defaultTab('transactions') });
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
export function normalizeTab(tab: TabId, raw: unknown): TabLayout {
  const def = defaultTab(tab), ids = BLOCKS[tab].map(b => b.id);
  if (!isObj(raw)) return def;
  const seen = new Set<string>(), order: string[] = [];
  if (Array.isArray(raw.order)) for (const id of raw.order) if (typeof id === 'string' && ids.includes(id) && !seen.has(id)) { seen.add(id); order.push(id); }
  for (const id of ids) if (!seen.has(id)) order.push(id); // blocks added after the layout was saved go to the end
  const on: Record<string, boolean> = {}, src = isObj(raw.on) ? raw.on : {};
  for (const id of ids) on[id] = typeof src[id] === 'boolean' ? (src[id] as boolean) : def.on[id];
  const out: TabLayout = { order: REORDERABLE[tab] ? order : ids, on };
  if (tab === 'home') out.n = typeof raw.n === 'number' && HISTORY_SIZES.includes(raw.n) ? raw.n : HISTORY_DEFAULT;
  return out;
}
export function normalizeLayout(raw: unknown): Layout {
  const r = isObj(raw) ? raw : {};
  return { home: normalizeTab('home', r.home), reports: normalizeTab('reports', r.reports), accounts: normalizeTab('accounts', r.accounts), transactions: normalizeTab('transactions', r.transactions) };
}
export const visible = (l: TabLayout) => l.order.filter(id => l.on[id]);
export const isDefaultTab = (tab: TabId, l: TabLayout) => JSON.stringify(normalizeTab(tab, l)) === JSON.stringify(defaultTab(tab));
export function move(l: TabLayout, id: string, dir: -1 | 1): TabLayout {
  const i = l.order.indexOf(id), j = i + dir; if (i < 0 || j < 0 || j >= l.order.length) return l;
  const order = [...l.order]; [order[i], order[j]] = [order[j], order[i]]; return { ...l, order };
}
export const toggle = (l: TabLayout, id: string): TabLayout => (id in l.on ? { ...l, on: { ...l.on, [id]: !l.on[id] } } : l);
