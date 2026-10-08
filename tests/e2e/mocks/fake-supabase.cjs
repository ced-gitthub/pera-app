// In-memory stand-in for Supabase: mirrors the query API + RLS ownership + the main constraints/functions of the SQL. It tests APP code, NOT the real SQL.
const crypto = require('crypto');
const DEF = { transactions: { description: '', notes: '', transfer_account_id: null, category_id: null, import_hash: null, external_id: null, recurring_id: null, request_id: null, request_idx: null }, accounts: { account_type: 'cash', opening_balance_minor: 0 }, recurring_transactions: { run_count: 0, active: true, end_date: null, description: '' }, categories: {}, budgets: {}, profiles: {}, tx_trash: {} };
const UNIQ = { transactions: [['user_id', 'request_id', 'request_idx'], ['user_id', 'import_hash'], ['user_id', 'external_id'], ['recurring_id', 'transaction_date']], accounts: [['user_id', 'name']], categories: [['user_id', 'name', 'type']], budgets: [['user_id', 'category_id', 'month', 'year']] };
const MAXM = 99999999999;
function db() { return { t: { accounts: [], categories: [], transactions: [], budgets: [], recurring_transactions: [], profiles: [], tx_trash: [] }, users: new Map(), cur: null, seq: 0, fail: false, failRpc: null, resets: [], resends: [], signouts: [], factors: [], aal2: new Set(), confirmEmail: false, rateLimit: false }; }
const E = (message, code) => ({ message, code });
function check(D, table, r) {
  const own = (tb, id) => D.t[tb].some(x => x.id === id && x.user_id === r.user_id);
  if (table === 'transactions') {
    if (!Number.isInteger(r.amount_minor) || r.amount_minor < 1 || r.amount_minor > MAXM) return E('amount_minor check violated', '23514');
    if (!['income', 'expense', 'transfer'].includes(r.type)) return E('type check violated', '23514'); if ((r.description ?? '').length > 120 || (r.notes ?? '').length > 500) return E('length check', '23514');
    if (!r.transaction_date || !/^\d{4}-\d\d-\d\d$/.test(r.transaction_date)) return E('invalid date', '22007');
    const ok = r.type === 'transfer' ? r.account_id && r.transfer_account_id && r.account_id !== r.transfer_account_id && !r.category_id : r.category_id && !r.transfer_account_id;
    if (!ok) return E('transactions_check violated', '23514');
    for (const [k, tb] of [['account_id', 'accounts'], ['transfer_account_id', 'accounts'], ['category_id', 'categories']]) if (r[k] && !own(tb, r[k])) return E('foreign key violation on ' + k, '23503');
  }
  if (table === 'accounts' && (!(r.name?.length >= 1 && r.name.length <= 40) || Math.abs(r.opening_balance_minor) > MAXM)) return E('accounts check violated', '23514');
  if (table === 'budgets' && !(r.amount_minor >= 0 && r.amount_minor <= MAXM && r.month >= 1 && r.month <= 12)) return E('budgets check violated', '23514');
  return null;
}
function uniqViolation(D, table, r, ignoreId) { for (const cols of UNIQ[table] ?? []) { if (cols.some(c => r[c] == null)) continue; if (D.t[table].some(x => x.id !== ignoreId && cols.every(c => x[c] === r[c]))) return E(`duplicate key value violates unique constraint (${cols})`, '23505'); } return null; }
function mkRow(D, table, o) { const now = new Date(1700000000000 + ++D.seq * 1000).toISOString(); return { id: crypto.randomUUID(), created_at: now, updated_at: now, ...(DEF[table] ?? {}), ...o }; }
const ownerKey = t => (t === 'profiles' ? 'id' : 'user_id');
function builder(D, table) {
  const st = { op: 'select', f: [], ord: [], rng: null, lim: null, one: null, count: null, head: false, ret: false, rows: null, patch: null, oc: null, ign: false };
  const b = {
    select(c, o) { st.ret = true; if (o) { st.count = o.count; st.head = o.head; } return b; },
    insert(r) { st.op = 'insert'; st.rows = Array.isArray(r) ? r : [r]; return b; }, upsert(r, o) { st.op = 'upsert'; st.rows = Array.isArray(r) ? r : [r]; st.oc = o?.onConflict?.split(','); st.ign = !!o?.ignoreDuplicates; return b; },
    update(p) { st.op = 'update'; st.patch = p; return b; }, delete() { st.op = 'delete'; return b; },
    eq(k, v) { st.f.push(r => r[k] === v); return b; }, neq(k, v) { st.f.push(r => r[k] !== v); return b; }, gte(k, v) { st.f.push(r => r[k] >= v); return b; }, lte(k, v) { st.f.push(r => r[k] <= v); return b; },
    in(k, a) { st.f.push(r => a.includes(r[k])); return b; }, ilike(k, p) { const re = new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i'); st.f.push(r => re.test(r[k] ?? '')); return b; },
    or(s) { const ps = s.split(',').map(x => { const [k, op, v] = x.split('.'); if (op !== 'eq') throw new Error('fake: unsupported or()'); return r => r[k] === v; }); st.f.push(r => ps.some(p => p(r))); return b; },
    order(k, o) { st.ord.push([k, o?.ascending === false ? -1 : 1]); return b; }, range(a, z) { st.rng = [a, z]; return b; }, limit(n) { st.lim = n; return b; },
    single() { st.one = 'single'; return b; }, maybeSingle() { st.one = 'maybe'; return b; },
    then(res, rej) { return Promise.resolve().then(run).then(res, rej); },
  };
  function run() {
    if (D.fail && st.op !== 'select') return { data: null, error: E('simulated outage', '08006') };
    if (!D.cur) return { data: null, error: E('JWT expired', 'PGRST301') };
    const T = D.t[table], ok = k => k === D.cur, mine = r => r[ownerKey(table)] === D.cur, pass = r => mine(r) && st.f.every(f => f(r));
    const out = rows => ({ data: st.ret ? rows.map(r => ({ ...r })) : null, error: null });
    if (st.op === 'select') {
      let rows = T.filter(pass); for (const [k, d] of [...st.ord].reverse()) rows.sort((a, b) => (a[k] < b[k] ? -d : a[k] > b[k] ? d : 0)); const count = rows.length;
      if (st.rng) rows = rows.slice(st.rng[0], st.rng[1] + 1); if (st.lim != null) rows = rows.slice(0, st.lim);
      if (st.head) return { data: null, error: null, count }; rows = rows.map(r => ({ ...r }));
      if (st.one) { if (rows.length > 1 || (st.one === 'single' && !rows.length)) return { data: null, error: E('JSON object requested, multiple (or no) rows returned', 'PGRST116') }; return { data: rows[0] ?? null, error: null }; }
      return { data: rows, error: null, count: st.count ? count : undefined };
    }
    if (st.op === 'insert' || st.op === 'upsert') {
      const made = [];
      for (const raw of st.rows) {
        if (raw.user_id !== D.cur && table !== 'profiles') return { data: null, error: E('new row violates row-level security policy for table "' + table + '"', '42501') };
        if (st.op === 'upsert') { const oc = st.oc ?? ['id']; const ex = T.find(x => mine(x) && oc.every(c => x[c] === raw[c]) && oc.every(c => raw[c] != null)); if (ex) { if (st.ign) continue; Object.assign(ex, raw); made.push(ex); continue; } }
        const row = mkRow(D, table, { ...raw }); const bad = check(D, table, row) ?? uniqViolation(D, table, row) ?? made.map(m => uniqViolation({ t: { [table]: [m] } }, table, row)).find(Boolean); if (bad) return { data: null, error: bad }; made.push(row);
      }
      for (const m of made) if (!T.includes(m)) T.push(m); return out(made);
    }
    if (st.op === 'update') { const rows = T.filter(pass); const bad = rows.map(r => { const n = { ...r, ...st.patch }; return check(D, table, n) ?? uniqViolation(D, table, n, r.id); }).find(Boolean); if (bad) return { data: null, error: bad }; rows.forEach(r => { Object.assign(r, st.patch, { updated_at: new Date().toISOString() }); }); return out(rows); }
    if (st.op === 'delete') {
      const rows = T.filter(pass), refs = { accounts: [['transactions', 'account_id'], ['transactions', 'transfer_account_id'], ['recurring_transactions', 'account_id']], categories: [['transactions', 'category_id'], ['budgets', 'category_id'], ['recurring_transactions', 'category_id']] }[table] ?? [];
      for (const r of rows) for (const [tb, c] of refs) if (D.t[tb].some(x => x[c] === r.id)) return { data: null, error: E('violates foreign key constraint (in use)', '23503') };
      if (table === 'transactions') for (const r of rows) { // mirrors 0005: on_tx_delete trigger (trash only)
        D.t.tx_trash.push(mkRow(D, 'tx_trash', { user_id: r.user_id, tx_id: r.id, row: { ...r }, deleted_at: new Date(1700000000000 + ++D.seq * 1000).toISOString() }));
      }
      if (table === 'recurring_transactions') for (const r of rows) { D.t.transactions.forEach(t => { if (t.recurring_id === r.id) t.recurring_id = null; }); } // ON DELETE SET NULL (recurring_id)
      D.t[table] = D.t[table].filter(r => !rows.includes(r)); return out(rows);
    }
  }
  return b;
}
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const addMonths = (s, n) => { const [y, m, d] = s.split('-').map(Number), t = (y * 12 + m - 1 + n), ny = Math.floor(t / 12), nm = t % 12 + 1; return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, lastDay(ny, nm))).padStart(2, '0')}`; };
const addDays = (s, n) => new Date(new Date(s + 'T00:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);
function rpc(D, name, a) {
  if (D.failRpc === name) return { data: null, error: E('relation "public.secret_internal_table" does not exist at character 14 (SQLSTATE 42P01)', '42P01') };
  if (!D.cur) return { data: null, error: E('JWT expired') }; const mine = D.t.transactions.filter(t => t.user_id === D.cur), inR = t => t.transaction_date >= a.p_from && t.transaction_date <= a.p_to;
  if (name === 'period_summary') { const g = {}; for (const t of mine.filter(t => inR(t) && t.type !== 'transfer')) { const k = t.type + '|' + t.category_id; g[k] ??= { type: t.type, category_id: t.category_id, total_minor: 0, n: 0 }; g[k].total_minor += t.amount_minor; g[k].n++; } return { data: Object.values(g), error: null }; }
  if (name === 'account_balances') return { data: D.t.accounts.filter(x => x.user_id === D.cur).map(x => ({ account_id: x.id, balance_minor: x.opening_balance_minor + mine.reduce((s, t) => s + (t.account_id === x.id ? (t.type === 'income' ? t.amount_minor : -t.amount_minor) : 0) + (t.transfer_account_id === x.id ? t.amount_minor : 0), 0) })), error: null };
  if (name === 'monthly_summary') { const o = {}; for (const t of mine.filter(t => t.type !== 'transfer' && t.transaction_date.startsWith(String(a.p_year)))) { const m = +t.transaction_date.slice(5, 7); o[m] ??= { month: m, income_minor: 0, expense_minor: 0 }; o[m][t.type + '_minor'] += t.amount_minor; } return { data: Object.values(o), error: null }; }
  if (name === 'account_spending') { const o = {}; for (const t of mine.filter(t => t.type === 'expense' && inR(t))) o[t.account_id] = (o[t.account_id] ?? 0) + t.amount_minor; return { data: Object.entries(o).map(([account_id, total_minor]) => ({ account_id, total_minor })), error: null }; }
  if (name === 'sum_expense') return { data: mine.filter(t => t.type === 'expense' && inR(t) && (!a.p_category || t.category_id === a.p_category) && (!a.p_account || t.account_id === a.p_account)).reduce((s, t) => s + t.amount_minor, 0), error: null };
  if (name === 'run_recurring') { let n = 0; const occ = (r, k) => ({ daily: () => addDays(r.start_date, k * r.interval_count), weekly: () => addDays(r.start_date, 7 * k * r.interval_count), monthly: () => addMonths(r.start_date, k * r.interval_count), yearly: () => addMonths(r.start_date, 12 * k * r.interval_count) })[r.frequency]();
    for (const r of D.t.recurring_transactions.filter(x => x.user_id === D.cur && x.active && x.next_run_date <= a.p_today)) { let k = r.run_count, d = occ(r, k); while (d <= a.p_today && (!r.end_date || d <= r.end_date)) { const row = mkRow(D, 'transactions', { user_id: r.user_id, account_id: r.account_id, category_id: r.category_id, type: r.type, amount_minor: r.amount_minor, description: r.description, transaction_date: d, recurring_id: r.id }); if (!uniqViolation(D, 'transactions', row)) { D.t.transactions.push(row); n++; } k++; d = occ(r, k); } r.run_count = k; r.next_run_date = d; r.active = !r.end_date || d <= r.end_date; } return { data: n, error: null }; }
  return { data: null, error: E('fake: unknown rpc ' + name) };
}
function client(D) {
  const id = () => D.cur ? { id: D.cur, email: D.users.get(D.cur).email, email_confirmed_at: D.users.get(D.cur).confirmed === false ? null : '2020-01-01T00:00:00Z', factors: D.factors.filter(f => f.user === D.cur).map(f => ({ id: f.id, factor_type: 'totp', status: f.status })) } : null;
  const mine = () => D.factors.filter(f => f.user === D.cur), ok = () => mine().filter(f => f.status === 'verified');
  return { from: t => builder(D, t), rpc: (n, a) => Promise.resolve(rpc(D, n, a ?? {})),
    auth: { resetPasswordForEmail: async (email, o) => { D.resets.push({ email, o }); return { error: null }; }, updateUser: async ({ password }) => { if (!D.cur) return { error: { code: 'session_not_found', message: 'Auth session missing!' } }; if (password.length < 6) return { error: { code: 'weak_password', message: 'weak' } }; D.users.get(D.cur).password = password; return { error: null }; }, exchangeCodeForSession: async (code) => { const u = D.recoveryCodes?.get(code); if (!u) return { error: { code: 'flow_state_not_found', message: 'invalid flow state' } }; D.cur = u; D.recoveryCodes.delete(code); return { error: null }; }, verifyOtp: async () => ({ error: { code: 'otp_expired', message: 'expired' } }),
      getUser: async () => ({ data: { user: id() } }), signOut: async (o) => { D.signouts.push(o?.scope ?? 'global'); if (o?.scope !== 'others') D.cur = null; return { error: null }; },
      resend: async ({ email, options }) => { if (D.rateLimit) return { error: { code: 'over_email_send_rate_limit', message: 'rate limit' } }; D.resends.push({ email, options }); return { error: null }; },
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: D.cur ? { currentLevel: D.aal2.has(D.cur) ? 'aal2' : 'aal1', nextLevel: ok().length ? 'aal2' : 'aal1' } : null }), listFactors: async () => ({ data: { all: mine().map(f => ({ id: f.id, status: f.status })), totp: ok().map(f => ({ id: f.id })) }, error: null }),
        enroll: async () => { const f = { id: crypto.randomUUID(), user: D.cur, status: 'unverified' }; D.factors.push(f); return { data: { id: f.id, totp: { qr_code: 'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg"/>', secret: 'JBSWY3DPEHPK3PXP' } }, error: null }; },
        challengeAndVerify: async ({ factorId, code }) => { const f = mine().find(x => x.id === factorId); if (!f) return { error: { code: 'mfa_factor_not_found', message: 'nf' } }; if (code !== '123456') return { error: { code: 'mfa_verification_failed', message: 'Invalid TOTP code entered' } }; f.status = 'verified'; D.aal2.add(D.cur); return { data: {}, error: null }; },
        unenroll: async ({ factorId }) => { if (!D.aal2.has(D.cur) && ok().length) return { error: { code: 'insufficient_aal', message: 'aal2 required' } }; D.factors = D.factors.filter(f => f.id !== factorId); return { data: {}, error: null }; } },
      signInWithPassword: async ({ email, password }) => { const u = [...D.users.values()].find(x => x.email === email && x.password === password); if (!u) return { error: { message: 'Invalid login credentials' } }; if (u.confirmed === false) return { error: { code: 'email_not_confirmed', message: 'Email not confirmed' } }; if (D.cur !== u.id) D.aal2.delete(u.id); D.cur = u.id; return { error: null }; },
      signUp: async ({ email, password, options }) => { if (!email || password.length < 6) return { error: { code: 'weak_password', message: 'Password should be at least 6 characters' } }; const u = { id: crypto.randomUUID(), email, password, confirmed: !D.confirmEmail }; D.users.set(u.id, u); if (!D.confirmEmail) D.cur = u.id; D.lastSignUp = options;
        for (const [n, ty] of [...['Salary', 'Freelance', 'Business', 'Investment', 'Gift', 'Other Income'].map(n => [n, 'income']), ...['Food', 'Groceries', 'Transportation', 'Bills', 'Utilities', 'Rent', 'Shopping', 'Entertainment', 'Health', 'Education', 'Subscriptions', 'Travel', 'Personal', 'Other'].map(n => [n, 'expense'])]) D.t.categories.push(mkRow(D, 'categories', { user_id: u.id, name: n, type: ty }));
        for (const [n, ty] of [['Cash', 'cash'], ['GCash', 'ewallet'], ['Maya', 'ewallet'], ['BPI', 'bank'], ['Credit Card', 'credit_card'], ['Savings', 'savings']]) D.t.accounts.push(mkRow(D, 'accounts', { user_id: u.id, name: n, account_type: ty }));
        D.t.profiles.push(mkRow(D, 'profiles', { id: u.id, email, name: options?.data?.name })); return { data: { session: D.confirmEmail ? null : { ok: 1 }, user: u }, error: null }; } } };
}
module.exports = { db, client };
