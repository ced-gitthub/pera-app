// tx_trash RLS block of the RLS suite (called from rls-suite.ts, after the bulk-delete block). Migration 0014: users may only SELECT and DELETE
// their own trash rows. Rows are written only by the security-definer delete trigger. Each step can fail: it asserts the exact refusal code 42501
// (writes) or an empty / unchanged result (reads, cross-user deletes), never just "some error".
// Run with node --experimental-strip-types: only erasable TypeScript syntax here.
import type { SupabaseClient } from '@supabase/supabase-js';

type Sb = SupabaseClient;
type TestUser = { c: Sb; id: string };
type Ctx = {
  A: TestUser;
  B: TestUser;
  anon: Sb;
  step: (name: string, fn: () => Promise<unknown>) => Promise<void>;
  other: Record<string, unknown>;
  d: string;
};

const code = (r: { error: { code?: string } | null }) => r.error?.code ?? (r.error ? 'error' : 'NO_ERROR');
type Stamp = { user_id: string; deleted_at: string };

export async function trashPolicySteps({ A, B, anon, step, other, d }: Ctx): Promise<void> {
  const t: { ok: boolean; aId: string; bId: string; aAt: string; bAt: string } = { ok: false, aId: '', bId: '', aAt: '', bAt: '' };
  const SKIP = 'skipped: trash setup failed (nothing was written)';
  const fakeRow = (uid: string) => ({
    user_id: uid,
    tx_id: crypto.randomUUID(),
    row: { x: 'y'.repeat(100) },
    deleted_at: new Date().toISOString(),
  });
  await step('tx_trash setup: A and B each get one trash row by deleting a transaction (the trigger writes it)', async () => {
    const bAcct = ((await B.c.from('accounts').select('id,name')).data ?? []).find((x: { name: string }) => x.name === 'Cash')?.id,
      bFood = ((await B.c.from('categories').select('id,name,type')).data ?? []).find(
        (x: { name: string; type: string }) => x.name === 'Food' && x.type === 'expense',
      )?.id;
    if (!bAcct || !bFood) return 'could not read the second test user defaults';
    const aT = await A.c
        .from('transactions')
        .insert({ ...other, amount_minor: 777, description: 'QA-TRASH-A' })
        .select('id')
        .single(),
      bT = await B.c
        .from('transactions')
        .insert({
          user_id: B.id,
          type: 'expense',
          category_id: bFood,
          account_id: bAcct,
          amount_minor: 888,
          transaction_date: d + '21',
          description: 'QA-TRASH-B',
        })
        .select('id')
        .single();
    if (aT.error || bT.error) return { a: aT.error?.message, b: bT.error?.message };
    const aD = await A.c.from('transactions').delete().eq('id', aT.data.id),
      bD = await B.c.from('transactions').delete().eq('id', bT.data.id);
    if (aD.error || bD.error) return { a: aD.error?.message, b: bD.error?.message };
    const a = await A.c.from('tx_trash').select('id,deleted_at').eq('tx_id', aT.data.id),
      b = await B.c.from('tx_trash').select('id,deleted_at').eq('tx_id', bT.data.id);
    if (a.error || b.error || a.data?.length !== 1 || b.data?.length !== 1)
      return { a: a.error?.message ?? a.data?.length, b: b.error?.message ?? b.data?.length };
    t.aId = a.data[0].id;
    t.aAt = a.data[0].deleted_at;
    t.bId = b.data[0].id;
    t.bAt = b.data[0].deleted_at;
    t.ok = true;
    return true;
  });
  await step('tx_trash: B cannot INSERT a trash row for itself or for A (42501), nor can anonymous', async () => {
    if (!t.ok) return SKIP;
    // A may already have other trash rows from earlier steps: compare against A's rows right before the attempts, not against "none"
    const aBefore = ((await A.c.from('tx_trash').select('id')).data ?? []).map((x: { id: string }) => x.id).sort();
    const own = await B.c.from('tx_trash').insert(fakeRow(B.id)),
      forA = await B.c.from('tx_trash').insert(fakeRow(A.id)),
      an = await anon.from('tx_trash').insert(fakeRow(A.id)),
      aAfter = await A.c.from('tx_trash').select('id');
    const sameForA =
      !aAfter.error && JSON.stringify((aAfter.data ?? []).map((x: { id: string }) => x.id).sort()) === JSON.stringify(aBefore);
    return code(own) === '42501' && code(forA) === '42501' && code(an) === '42501' && sameForA
      ? true
      : { own: code(own), forA: code(forA), anon: code(an), aTrashUnchanged: sameForA };
  });
  await step("tx_trash: B cannot UPDATE its own or A's trash row (42501); deleted_at and ownership are unchanged", async () => {
    if (!t.ok) return SKIP;
    const future = new Date(Date.now() + 365 * 86400000).toISOString();
    const own = await B.c.from('tx_trash').update({ deleted_at: future }).eq('id', t.bId).select('id'),
      ownUser = await B.c.from('tx_trash').update({ user_id: A.id }).eq('id', t.bId).select('id'),
      theirs = await B.c.from('tx_trash').update({ deleted_at: future }).eq('id', t.aId).select('id'),
      bNow = await B.c.from('tx_trash').select('user_id,deleted_at').eq('id', t.bId),
      aNow = await A.c.from('tx_trash').select('user_id,deleted_at').eq('id', t.aId);
    const same = (r: { data: Stamp[] | null }, uid: string, at: string) =>
      r.data?.length === 1 && r.data[0].user_id === uid && new Date(r.data[0].deleted_at).getTime() === new Date(at).getTime();
    return code(own) === '42501' &&
      code(ownUser) === '42501' &&
      code(theirs) === '42501' &&
      same(bNow, B.id, t.bAt) &&
      same(aNow, A.id, t.aAt)
      ? true
      : { own: code(own), ownUser: code(ownUser), theirs: code(theirs), bSame: same(bNow, B.id, t.bAt), aSame: same(aNow, A.id, t.aAt) };
  });
  await step('tx_trash: B can still SELECT only its own rows; A sees only its own', async () => {
    if (!t.ok) return SKIP;
    const b = await B.c.from('tx_trash').select('id,user_id'),
      a = await A.c.from('tx_trash').select('id,user_id');
    const bRows = b.data ?? [],
      aRows = a.data ?? [];
    return !b.error &&
      !a.error &&
      bRows.some((x) => x.id === t.bId) &&
      bRows.every((x) => x.user_id === B.id) &&
      !bRows.some((x) => x.id === t.aId) &&
      aRows.some((x) => x.id === t.aId) &&
      aRows.every((x) => x.user_id === A.id) &&
      !aRows.some((x) => x.id === t.bId)
      ? true
      : { b: b.error?.message ?? bRows.length, a: a.error?.message ?? aRows.length };
  });
  await step(
    "tx_trash: B cannot DELETE A's trash row (empty result, row still there); B can DELETE its own (undo spends the copy)",
    async () => {
      if (!t.ok) return SKIP;
      const theirs = await B.c.from('tx_trash').delete().eq('id', t.aId).select('id'),
        aStill = await A.c.from('tx_trash').select('id').eq('id', t.aId),
        mine = await B.c.from('tx_trash').delete().eq('id', t.bId).select('id'),
        bGone = await B.c.from('tx_trash').select('id').eq('id', t.bId);
      return !theirs.error &&
        (theirs.data ?? []).length === 0 &&
        (aStill.data ?? []).length === 1 &&
        !mine.error &&
        (mine.data ?? []).length === 1 &&
        !bGone.error &&
        (bGone.data ?? []).length === 0
        ? true
        : {
            theirs: theirs.error?.message ?? theirs.data?.length,
            aStill: aStill.data?.length,
            mine: mine.error?.message ?? mine.data?.length,
            bGone: bGone.data?.length,
          };
    },
  );
  await step("tx_trash: A can DELETE its own row afterwards (cleanup) and A's other data is untouched", async () => {
    if (!t.ok) return SKIP;
    const mine = await A.c.from('tx_trash').delete().eq('id', t.aId).select('id'),
      acc = await A.c.from('accounts').select('id', { count: 'exact', head: true });
    return !mine.error && (mine.data ?? []).length === 1 && !acc.error && (acc.count ?? 0) > 0
      ? true
      : { mine: mine.error?.message ?? mine.data?.length, acc: acc.count };
  });
}
