import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

export const HTML = fs.readFileSync('artifact/pera-artifact.html', 'utf8');
export const slice = (name: string) => {
  const a = HTML.indexOf(`/*${name}:BEGIN*/`);
  const b = HTML.indexOf(`/*${name}:END*/`);
  assert.ok(a >= 0 && b > a, `${name} markers missing`);
  return HTML.slice(a, b);
};
export type St = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type Res = {
  ok: boolean;
  kind?: string;
  message: string;
  counts?: Record<string, number>;
  id?: string;
  got?: Record<string, number>;
  skipped?: number;
  kept?: boolean;
};
export type Un = {
  counts(): Record<string, number>;
  total(c: Record<string, number>): number;
  list(): { id: string; at: number; expiresAt: number; counts: Record<string, number>; payload: St }[];
  write(r: unknown): { ok: boolean; kind?: string };
  drop(id: string): boolean;
  clearAll(typed: string): Res;
  plan(c: Record<string, number>): { tooBig: boolean; n: number; replaced: { id: string; at: number; counts: Record<string, number> }[] };
  restore(id: string): Res;
  summary(c: Record<string, number>): string;
  KEY: string;
  MAX: number;
  DAYS: number;
};
export const factory = vm.runInNewContext(`${slice('UNDOCORE')};UNDOCORE`) as (env: unknown) => Un;
export const J = <T>(x: T): T => JSON.parse(JSON.stringify(x));

export function device(
  over: {
    sync?: () => void;
    uidp?: string;
    saveOk?: () => boolean;
    storeFail?: (k: string, v: string) => boolean;
    now?: () => number;
    state?: St;
  } = {},
) {
  const mem = new Map<string, string>();
  let clock = 1_800_000_000_000;
  let n = 0;
  const S: St = over.state ?? {
    tx: [
      { id: 't1', n: 1, date: '2026-10-01', type: 'expense', amount: 10, cat: 'Food', acct: 'Cash' },
      { id: 't2', n: 2, date: '2026-10-02', type: 'income', amount: 20, cat: 'Salary', acct: 'Cash' },
      { id: 'd1', n: 3, date: '2026-10-03', type: 'expense', amount: 5, cat: 'Food', acct: 'Cash', demo: true },
    ],
    trash: [{ id: 'tr1', date: '2026-09-01', type: 'expense', amount: 1, cat: 'Food', acct: 'Cash' }],
    bud: { Food: 3000, Transportation: 1000 },
    rec: [{ id: 'r1', next: '2026-11-01', amount: 5, type: 'expense', cat: 'Food', acct: 'Cash' }],
    open: { Cash: 500, GCash: 0 },
    accts: ['Cash', 'GCash'],
    cats: { inc: ['Salary'], exp: ['Food', 'Transportation'] },
    alias: { GCash: ['gc'] },
    fresh: 0,
  };
  let saves = 0;
  const env = {
    S: () => S,
    sync: over.sync ?? (() => {}),
    save: () => {
      saves++;
      return over.saveOk ? over.saveOk() : true;
    },
    now: over.now ?? (() => clock),
    store: {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (over.storeFail?.(k, v)) throw new Error('quota');
        mem.set(k, v);
      },
    },
    uid: (p: string) => `${over.uidp ?? ''}${p}_${++n}`,
  };
  const U = factory(env);
  return { U, S, mem, saves: () => saves, tick: (ms: number) => (clock += ms) };
}
export const DAY = 864e5;
