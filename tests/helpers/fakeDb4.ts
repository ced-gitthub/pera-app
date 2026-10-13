// Minimal chainable fake of the Supabase client, only what native/src/resetCore.ts uses. Owned by the reset tests.
import type { Db } from '../../native/src/resetCore.ts';

type Err = { message: string; code?: string } | null;
type Res = { count?: number | null; error: Err };

export type FakeOpts = {
  counts?: Record<string, number>; // rows per table
  failCount?: boolean; // the count query returns an error
  failDelete?: boolean; // the delete returns an error
  error?: Err; // the error returned (default: raw database text)
};

export function fakeDb4(o: FakeOpts = {}) {
  const counts = { ...(o.counts ?? {}) };
  const err: Err = o.error ?? { message: 'permission denied for table transactions (raw)', code: '42501' };
  const log = {
    counts: [] as { table: string; cols: string; opts: unknown }[],
    deletes: [] as { table: string; col: string; op: string; value: unknown }[],
  };
  const db: Db = {
    from(table: string) {
      return {
        select(cols: string, opts: { count: 'exact'; head: true }): PromiseLike<Res> {
          log.counts.push({ table, cols, opts });
          if (o.failCount) return Promise.resolve({ count: null, error: err });
          return Promise.resolve({ count: counts[table] ?? 0, error: null });
        },
        delete() {
          return {
            not(col: string, op: string, value: unknown): PromiseLike<Res> {
              log.deletes.push({ table, col, op, value });
              if (o.failDelete) return Promise.resolve({ error: err });
              counts[table] = 0;
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
  return { db, log, counts };
}
