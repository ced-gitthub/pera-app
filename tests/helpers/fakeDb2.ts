// Tiny in-memory stand-in for the chainable Supabase client, just enough for native/src/recurringCore.ts.
type Err = { message: string; code?: string } | null;
type Row = Record<string, unknown>;
export type Call = { table: string; op: 'select' | 'insert' | 'update' | 'delete'; payload?: Row; filters: [string, unknown][] };

export function makeFakeDb(
  seed: Record<string, Row[]> = {},
  opts: { errorFor?: (c: Call) => Err; rpc?: (fn: string, args: Row) => { data: unknown; error: Err } } = {},
) {
  const tables: Record<string, Row[]> = {};
  for (const k of Object.keys(seed)) tables[k] = seed[k].map((r) => ({ ...r }));
  const calls: Call[] = [];
  const rpcCalls: { fn: string; args: Row }[] = [];

  function from(table: string) {
    const call: Call = { table, op: 'select', filters: [] };
    let wantOne = false;
    const settle = () => {
      calls.push(call);
      const error = opts.errorFor?.(call) ?? null;
      if (error) return { data: null, error };
      const rows = (tables[table] ??= []);
      const match = (r: Row) => call.filters.every(([c, v]) => r[c] === v);
      if (call.op === 'insert') {
        const dup = rows.some((r) => r.id === call.payload?.id);
        if (dup) return { data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' } };
        rows.push({ ...call.payload });
        return { data: null, error: null };
      }
      if (call.op === 'update') {
        for (const r of rows.filter(match)) Object.assign(r, call.payload);
        return { data: null, error: null };
      }
      if (call.op === 'delete') {
        tables[table] = rows.filter((r) => !match(r));
        return { data: null, error: null };
      }
      const found = rows.filter(match).map((r) => ({ ...r }));
      if (wantOne) return found.length ? { data: found[0], error: null } : { data: null, error: { message: 'no rows', code: 'PGRST116' } };
      return { data: found, error: null };
    };
    const q = {
      select: () => q,
      eq: (c: string, v: unknown) => (call.filters.push([c, v]), q),
      single: () => ((wantOne = true), q),
      insert: (v: Row) => ((call.op = 'insert'), (call.payload = v), q),
      update: (v: Row) => ((call.op = 'update'), (call.payload = v), q),
      delete: () => ((call.op = 'delete'), q),
      then: <T>(ok: (v: { data: unknown; error: Err }) => T, no?: (e: unknown) => T) => Promise.resolve(settle()).then(ok, no),
    };
    return q;
  }
  const rpc = (fn: string, args: Row) => {
    rpcCalls.push({ fn, args });
    return Promise.resolve(opts.rpc ? opts.rpc(fn, args) : { data: 0, error: null });
  };
  return { db: { from, rpc }, tables, calls, rpcCalls };
}
