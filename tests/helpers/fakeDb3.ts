// Minimal chainable fake of the Supabase client, only what native/src/csvCore.ts uses. Owned by the CSV tests.
import type { CsvDb } from '../../native/src/csvCore.ts';

type Err = { message: string; code?: string } | null;
type Res = { data: Record<string, unknown>[] | null; error: Err };

export type FakeOpts = {
  rows?: Record<string, unknown>[]; // what the transactions table holds for export reads
  failPage?: number; // 0-based index of the select().range() call that returns an error
  failBatch?: number; // 0-based index of the upsert call that returns an error
  failError?: Err; // the error to return (default: raw database text)
  existing?: Set<string>; // import_hash values the table already has
};

export function fakeDb3(o: FakeOpts = {}) {
  const log = {
    ranges: [] as [number, number][],
    filters: [] as string[],
    upserts: [] as { size: number; opts: unknown }[],
  };
  const existing = o.existing ?? new Set<string>();
  const err: Err = o.failError ?? { message: 'duplicate key value violates constraint "transactions_pkey" (raw)', code: '23505' };
  let upsertCalls = 0;
  let pageCalls = 0;

  const db: CsvDb = {
    from() {
      return {
        select() {
          let lo: string | null = null;
          let hi: string | null = null;
          const q = {
            gte(_c: string, v: string) {
              lo = v;
              log.filters.push(`gte:${v}`);
              return q;
            },
            lte(_c: string, v: string) {
              hi = v;
              log.filters.push(`lte:${v}`);
              return q;
            },
            order() {
              return q;
            },
            range(a: number, b: number): PromiseLike<Res> {
              log.ranges.push([a, b]);
              const idx = pageCalls++;
              if (o.failPage === idx) return Promise.resolve({ data: null, error: err });
              const all = (o.rows ?? []).filter((r) => {
                const d = String(r.transaction_date ?? '');
                return (lo === null || d >= lo) && (hi === null || d <= hi);
              });
              return Promise.resolve({ data: all.slice(a, b + 1), error: null });
            },
          };
          return q;
        },
        upsert(rows, opts) {
          log.upserts.push({ size: rows.length, opts });
          const idx = upsertCalls++;
          return {
            select(): PromiseLike<Res> {
              if (o.failBatch === idx) return Promise.resolve({ data: null, error: err });
              const fresh = rows.filter((r) => {
                const h = String(r.import_hash);
                if (existing.has(h)) return false; // ignoreDuplicates: silently skipped, not returned
                existing.add(h);
                return true;
              });
              return Promise.resolve({ data: fresh.map((_, i) => ({ id: `n${idx}-${i}` })), error: null });
            },
          };
        },
      };
    },
  };
  return { db, log, existing };
}
