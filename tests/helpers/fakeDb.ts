// A tiny chainable stand-in for the Supabase client. It records every call and returns the result
// configured for "table.op" (op = select | insert | upsert | update | delete). No network, no react-native.
export type FakeRes = { data?: unknown; error?: { message: string; code?: string } | null; count?: number | null };
export type FakeCall = {
  n: number; // global order of the call
  table: string;
  op: string;
  args: unknown[]; // arguments of the op method (e.g. the row and options of an upsert)
  filters: [string, unknown][]; // .eq() filters
  selected?: unknown[]; // arguments of a trailing .select() (returning)
  limit?: number;
};
type Setting = FakeRes | FakeRes[] | ((call: FakeCall) => FakeRes) | 'throw';

export function fakeDb(results: Record<string, Setting> = {}) {
  const calls: FakeCall[] = [];
  const used: Record<string, number> = {};
  let n = 0;

  const resolve = (call: FakeCall): FakeRes => {
    const key = `${call.table}.${call.op}`;
    const s = results[key];
    if (s === 'throw') throw new Error('network down');
    if (typeof s === 'function') return s(call);
    if (Array.isArray(s)) {
      const i = used[key] ?? 0;
      used[key] = i + 1;
      return s[Math.min(i, s.length - 1)] ?? { data: null, error: null };
    }
    return s ?? { data: null, error: null, count: null };
  };

  function query(table: string) {
    const call: FakeCall = { n: n++, table, op: '', args: [], filters: [] };
    calls.push(call);
    const op =
      (name: string) =>
      (...args: unknown[]) => {
        if (!call.op) {
          call.op = name;
          call.args = args;
        } else if (name === 'select') call.selected = args;
        return q;
      };
    const run = () => {
      try {
        return Promise.resolve(resolve(call));
      } catch (e) {
        return Promise.reject(e);
      }
    };
    const q = {
      select: op('select'),
      insert: op('insert'),
      upsert: op('upsert'),
      update: op('update'),
      delete: op('delete'),
      eq: (col: string, val: unknown) => {
        call.filters.push([col, val]);
        return q;
      },
      in: (col: string, val: unknown) => {
        call.filters.push([col + ' in', val]);
        return q;
      },
      limit: (v: number) => {
        call.limit = v;
        return q;
      },
      maybeSingle: () => run(),
      then: (ok: (r: FakeRes) => unknown, bad?: (e: unknown) => unknown) => run().then(ok, bad),
    };
    return q;
  }

  return {
    from: (table: string) => query(table),
    calls,
    // calls of one table+op, in order
    of: (table: string, op: string) => calls.filter((c) => c.table === table && c.op === op),
  };
}
