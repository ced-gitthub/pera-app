// Stand-in for the secret-key Supabase client: just the backup_emails table + the two admin auth calls the app uses. No RLS (like the real secret key).
const E = (message: string, code?: string) => ({ message, code });
export const adminConfigured = () => !!process.env.SUPABASE_SECRET_KEY;
export function admin() {
  const D = (globalThis as any).__D; D.backup ??= []; D.links ??= []; const T: any[] = D.backup;
  const dup = (r: any, skip?: any) => r.verified_at && T.some(x => x !== skip && x.verified_at && x.email === r.email);
  const from = (_t: string) => {
    const f: ((r: any) => boolean)[] = []; let op = 'select', patch: any, row: any, lim: number | null = null, one = false;
    const b: any = {
      select() { return b; }, eq(k: string, v: any) { f.push(r => r[k] === v); return b; }, limit(n: number) { lim = n; return b; }, maybeSingle() { one = true; return b; },
      upsert(r: any) { op = 'upsert'; row = r; return b; }, update(p: any) { op = 'update'; patch = p; return b; }, delete() { op = 'delete'; return b; },
      then(res: any, rej: any) { return Promise.resolve().then(run).then(res, rej); },
    };
    function run() {
      if (D.adminFail) return { data: null, error: E('admin down', 'XX000') };
      const m = T.filter(r => f.every(x => x(r)));
      if (op === 'select') { const rows = lim != null ? m.slice(0, lim) : m; return one ? { data: rows[0] ? { ...rows[0] } : null, error: null } : { data: rows.map(r => ({ ...r })), error: null }; }
      if (op === 'upsert') { const i = T.findIndex(x => x.user_id === row.user_id); if (dup(row, i >= 0 ? T[i] : undefined)) return { data: null, error: E('duplicate key', '23505') }; if (i >= 0) T[i] = { ...row }; else T.push({ ...row }); return { data: null, error: null }; }
      if (op === 'update') { for (const r of m) { const n = { ...r, ...patch }; if (dup(n, r)) return { data: null, error: E('duplicate key', '23505') }; Object.assign(r, patch); } return { data: null, error: null }; }
      if (op === 'delete') { for (const r of m) T.splice(T.indexOf(r), 1); return { data: null, error: null }; }
    }
    return b;
  };
  return { from, auth: { admin: {
    getUserById: async (id: string) => { const u = D.users.get(id); return u ? { data: { user: { id, email: u.email } }, error: null } : { data: { user: null }, error: null }; },
    generateLink: async ({ email }: { email: string }) => { const u = [...D.users.values()].find((x: any) => x.email === email); if (!u) return { data: null, error: E('User not found') }; const t = 'hash-' + u.id; D.links.push(t); return { data: { properties: { hashed_token: t } }, error: null }; },
  } } };
}
