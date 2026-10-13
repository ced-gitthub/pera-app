// Bulk-delete block of the RLS suite (called from rls-suite.ts). Kept separate to stay under the file-size limit.
// Run with node --experimental-strip-types: only erasable TypeScript syntax here (no enums, no parameter properties).
import type { SupabaseClient } from '@supabase/supabase-js';

type Sb = SupabaseClient;
type TestUser = { c: Sb; id: string };
type Ctx = {
  A: TestUser;
  B: TestUser;
  step: (name: string, fn: () => Promise<unknown>) => Promise<void>;
  cnt: (r: { error: unknown; data: unknown[] | null }) => number;
  other: Record<string, unknown>;
  d: string;
  mk: () => Sb;
};

const SKIP = 'skipped: isolation canary failed (no delete was sent)';

// Native "Delete data" (native/src/resetCore.ts) sends UNFILTERED deletes `.delete().not('id','is',null)` with the person's own token.
// Nothing but RLS stops them touching other people's rows, so prove it: B wipes transactions, budgets and savings_goals while A keeps everything.
// SAFETY: these tables are PRODUCTION tables. An unfiltered delete is only ever sent when `bulk.ready` is true, i.e. setup passed AND an
// unfiltered select as B returned only B's own rows in each table. If the canary fails, every destructive step reports FAILED and sends nothing.
export async function bulkDeleteSteps({ A, B, step, cnt, other, d }: Ctx): Promise<void> {
  const wipe = (c: Sb, t: string, opts?: { count: 'exact' }) => c.from(t).delete(opts).not('id', 'is', null);
  const idsOf = async (c: Sb, t: string, col = 'id') => {
    const r = await c.from(t).select(col);
    return r.error ? null : ((r.data ?? []) as unknown as Record<string, string>[]).map((x) => x[col]).sort();
  };
  const WIPE_TABLES = ['transactions', 'budgets', 'savings_goals'];
  const bulk: { setupOk: boolean; ready: boolean; aIds: Record<string, string[] | null>; aTrash: string[]; bTx: string[] } = {
    setupOk: false,
    ready: false,
    aIds: {},
    aTrash: [],
    bTx: [],
  };
  await step(
    'bulk delete setup: A and B both own rows in transactions, budgets, savings_goals; A has a trash row; B has none',
    async () => {
      const bAcct = ((await B.c.from('accounts').select('id,name')).data ?? []).find((x: { name: string }) => x.name === 'Cash')?.id,
        bCats: { id: string; name: string; type: string }[] = (await B.c.from('categories').select('id,name,type')).data ?? [],
        bFood = bCats.find((x) => x.name === 'Food' && x.type === 'expense')?.id,
        bGro = bCats.find((x) => x.name === 'Groceries' && x.type === 'expense')?.id;
      if (!bAcct || !bFood || !bGro) return 'could not read the second test user defaults';
      const bt = (n: number) => ({
        user_id: B.id,
        type: 'expense',
        category_id: bFood,
        account_id: bAcct,
        amount_minor: 1000 + n,
        transaction_date: d + '20',
        description: 'QA-BULK',
      });
      const bTx = await B.c
          .from('transactions')
          .insert([bt(1), bt(2), bt(3)])
          .select('id'),
        bBud = await B.c.from('budgets').insert([
          { user_id: B.id, category_id: bFood, amount_minor: 50000, month: 3, year: 2020 },
          { user_id: B.id, category_id: bGro, amount_minor: 60000, month: 3, year: 2020 },
        ]),
        bGoal = await B.c.from('savings_goals').insert([
          { user_id: B.id, name: 'QA-B1', target_minor: 1000 },
          { user_id: B.id, name: 'QA-B2', target_minor: 2000 },
        ]);
      if (bTx.error || bBud.error || bGoal.error) return { tx: bTx.error?.message, bud: bBud.error?.message, goal: bGoal.error?.message };
      bulk.bTx = ((bTx.data ?? []) as { id: string }[]).map((x) => x.id).sort();
      // A already owns many transactions, 1 budget and 12 goals (the cap) from the steps above. Give A one deleted transaction so A also has a trash row.
      const aT = await A.c
        .from('transactions')
        .insert({ ...other, amount_minor: 4321, description: 'QA-BULK-A-TRASH' })
        .select('id')
        .single();
      if (aT.error) return 'A trash seed insert failed: ' + aT.error.message;
      const aDel = await A.c.from('transactions').delete().eq('id', aT.data.id);
      if (aDel.error) return 'A trash seed delete failed: ' + aDel.error.message;
      for (const t of WIPE_TABLES) bulk.aIds[t] = await idsOf(A.c, t);
      bulk.aTrash = (await idsOf(A.c, 'tx_trash')) ?? [];
      const seen = {
        a: WIPE_TABLES.map((t) => bulk.aIds[t]?.length ?? -1),
        aTrash: bulk.aTrash.length,
        b: [(await idsOf(B.c, 'transactions'))?.length, (await idsOf(B.c, 'budgets'))?.length, (await idsOf(B.c, 'savings_goals'))?.length],
        bTrash: (await idsOf(B.c, 'tx_trash'))?.length,
      };
      bulk.setupOk = seen.a.every((n) => n > 0) && seen.aTrash >= 1 && seen.b.join() === '3,2,2' && seen.bTrash === 0;
      return bulk.setupOk ? true : seen;
    },
  );
  await step(
    "bulk delete canary: an unfiltered select as B returns only B's own rows in all three tables (gates every delete below)",
    async () => {
      if (!bulk.setupOk) return 'setup did not pass, so isolation was not checked and no delete will be sent';
      const seen: Record<string, { n: number | string; foreign: number }> = {};
      let ok = true;
      for (const t of WIPE_TABLES) {
        const r = await B.c.from(t).select('user_id');
        const rows = (r.data ?? []) as { user_id: string }[];
        const foreign = rows.filter((x) => x.user_id !== B.id).length;
        seen[t] = { n: r.error ? 'error: ' + r.error.message : rows.length, foreign };
        if (r.error || rows.length < 1 || foreign > 0) ok = false;
      }
      bulk.ready = ok;
      return ok ? true : seen;
    },
  );
  await step("bulk delete: B runs the three unfiltered deletes; each reports only B's own row count (3 / 2 / 2) and no error", async () => {
    if (!bulk.ready) return SKIP;
    const r = [] as { error: { message: string } | null; count: number | null }[];
    for (const t of WIPE_TABLES) r.push(await wipe(B.c, t, { count: 'exact' }));
    return r.every((x) => !x.error) && r.map((x) => x.count).join() === '3,2,2'
      ? true
      : r.map((x) => ({ err: x.error?.message, count: x.count }));
  });
  await step("bulk delete: B's own rows are gone from all three tables; running it again on empty tables is a harmless no-op", async () => {
    if (!bulk.ready) return SKIP;
    const left = await Promise.all(WIPE_TABLES.map((t) => idsOf(B.c, t)));
    const again = await Promise.all(WIPE_TABLES.map((t) => wipe(B.c, t)));
    return left.every((x) => x !== null && x.length === 0) && again.every((x) => !x.error)
      ? true
      : { left: left.map((x) => x?.length ?? 'error'), again: again.map((x) => x.error?.message ?? 'ok') };
  });
  await step("bulk delete: A's rows in all three tables are untouched (same ids, same counts as before)", async () => {
    if (!bulk.ready) return SKIP;
    const now = await Promise.all(WIPE_TABLES.map((t) => idsOf(A.c, t)));
    const same = WIPE_TABLES.every((t, i) => JSON.stringify(now[i]) === JSON.stringify(bulk.aIds[t]));
    return same ? true : { before: WIPE_TABLES.map((t) => bulk.aIds[t]?.length ?? 'error'), after: now.map((x) => x?.length ?? 'error') };
  });
  await step("bulk delete: tx_trash has only B's deleted transactions for B and only A's for A; neither can see the other's", async () => {
    if (!bulk.ready) return SKIP;
    const bt = await B.c.from('tx_trash').select('tx_id,user_id'),
      at = await A.c.from('tx_trash').select('id,user_id'),
      aSeesB = await A.c.from('tx_trash').select('id').eq('user_id', B.id),
      bSeesA = await B.c.from('tx_trash').select('id').eq('user_id', A.id);
    const bRows = (bt.data ?? []) as { tx_id: string; user_id: string }[],
      aRows = (at.data ?? []) as { id: string; user_id: string }[];
    return !bt.error &&
      !at.error &&
      JSON.stringify(bRows.map((x) => x.tx_id).sort()) === JSON.stringify(bulk.bTx) &&
      bRows.every((x) => x.user_id === B.id) &&
      JSON.stringify(aRows.map((x) => x.id).sort()) === JSON.stringify(bulk.aTrash) &&
      aRows.every((x) => x.user_id === A.id) &&
      cnt(aSeesB) === 0 &&
      cnt(bSeesA) === 0
      ? true
      : { b: bRows.length, a: aRows.length, aSeesB: cnt(aSeesB), bSeesA: cnt(bSeesA), err: bt.error?.message ?? at.error?.message };
  });
  // The native app's "Delete ALL my records" (native/src/resetCore.ts resetAllWith) sends the same unfiltered deletes in this exact order. Earlier steps emptied B, so B is re-seeded first.
  await step(
    "bulk delete in the native app's order (budgets, savings_goals, transactions): B ends with none left and A's rows in all three tables are untouched",
    async () => {
      if (!bulk.ready) return SKIP;
      const bAcct = ((await B.c.from('accounts').select('id,name')).data ?? []).find((x: { name: string }) => x.name === 'Cash')?.id,
        bFood = ((await B.c.from('categories').select('id,name,type')).data ?? []).find(
          (x: { name: string; type: string }) => x.name === 'Food' && x.type === 'expense',
        )?.id;
      if (!bAcct || !bFood) return 'could not read the second test user defaults';
      const tx = (n: number) => ({
        user_id: B.id,
        type: 'expense',
        category_id: bFood,
        account_id: bAcct,
        amount_minor: 2000 + n,
        transaction_date: d + '21',
        description: 'QA-BULK-ORDER',
      });
      const s1 = await B.c.from('transactions').insert([tx(1), tx(2)]),
        s2 = await B.c.from('budgets').insert({ user_id: B.id, category_id: bFood, amount_minor: 70000, month: 4, year: 2020 }),
        s3 = await B.c.from('savings_goals').insert({ user_id: B.id, name: 'QA-B-ORDER', target_minor: 3000 });
      if (s1.error || s2.error || s3.error) return { reseed: [s1.error?.message, s2.error?.message, s3.error?.message] };
      const seeded = await Promise.all(['budgets', 'savings_goals', 'transactions'].map((t) => idsOf(B.c, t)));
      if (seeded.map((x) => x?.length).join() !== '1,1,2') return { seeded: seeded.map((x) => x?.length ?? 'error') };
      const order = ['budgets', 'savings_goals', 'transactions'];
      const r = [] as { error: { message: string } | null; count: number | null }[];
      for (const t of order) r.push(await wipe(B.c, t, { count: 'exact' }));
      const left = await Promise.all(WIPE_TABLES.map((t) => idsOf(B.c, t)));
      const aNow = await Promise.all(WIPE_TABLES.map((t) => idsOf(A.c, t)));
      const aSame = WIPE_TABLES.every((t, i) => JSON.stringify(aNow[i]) === JSON.stringify(bulk.aIds[t]));
      return r.every((x) => !x.error) &&
        r.map((x) => x.count).join() === '1,1,2' &&
        left.every((x) => x !== null && x.length === 0) &&
        aSame
        ? true
        : {
            deletes: r.map((x) => ({ err: x.error?.message, count: x.count })),
            bLeft: left.map((x) => x?.length ?? 'error'),
            aBefore: WIPE_TABLES.map((t) => bulk.aIds[t]?.length ?? 'error'),
            aAfter: aNow.map((x) => x?.length ?? 'error'),
          };
    },
  );
}
