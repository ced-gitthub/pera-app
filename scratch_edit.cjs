const fs = require('fs');
const edit = (f, fn) => { const a = fs.readFileSync(f, 'utf8'); const b = fn(a); if (a === b) throw new Error('no change: ' + f); fs.writeFileSync(f, b); };
const rep = (s, from, to) => { if (!s.includes(from)) throw new Error('missing: ' + from.slice(0, 60)); return s.replace(from, to); };
edit('native/src/entriesCore.ts', (s) => rep(s, "  in(column: string, values: unknown[]): Query;", "  in(column: string, values: unknown[]): Query;\n  like(column: string, pattern: string): Query;"));
edit('native/src/sampleCore.ts', (s) => {
  const a = s.indexOf('// Deletes only this user');
  const b = s.indexOf('// Starts sample entries safely');
  const block = `// Deletes only this user's rows whose request id is one of the fixed sample ids AND whose description still starts with "Sample:" (an entry the
// person edited into a real one is left alone). Then counts what is left: a delete that row-level security filtered to nothing is not a success.
export async function removeSampleWith(db: Db, userId: string): Promise<string | null> {
  try {
    if (!userId) return SAMPLE_REMOVE_FAIL;
    const mine = (q: Query) => q.eq('user_id', userId).in('request_id', SAMPLE_IDS).like('description', SAMPLE_LABEL + '%');
    const { error } = await mine(db.from('transactions').delete()).select('id');
    if (error) return SAMPLE_REMOVE_FAIL;
    const { count, error: countError } = await mine(db.from('transactions').select('id', { count: 'exact', head: true }));
    return countError || count !== 0 ? SAMPLE_REMOVE_FAIL : null;
  } catch {
    return SAMPLE_REMOVE_FAIL;
  }
}

`;
  s = s.slice(0, a) + block + s.slice(b);
  s = rep(s, "import { createEntryWith, type Db } from './entriesCore.ts';", "import { createEntryWith, type Db, type Query } from './entriesCore.ts';");
  s = rep(s, "import { SAMPLE_FAIL, SAMPLE_IDS, SAMPLE_REMOVE_FAIL, type SampleRow }", "import { SAMPLE_FAIL, SAMPLE_IDS, SAMPLE_LABEL, SAMPLE_REMOVE_FAIL, type SampleRow }");
  return s;
});
edit('native/src/sampleLogic.ts', (s) => {
  s = rep(s, "type Seed =", "export const SAMPLE_LABEL = 'Sample:';\ntype Seed =");
  return s;
});
edit('native/src/Gate.tsx', (s) => rep(s, "    if (k === 'skip') return setChoose(false);", "    if (k === 'skip') {\n      setChoose(false);\n      void samplePending(uid).then((on) => on && setSampleEnd(true)); // samples added in the wizard still get their Keep / Clear question\n      return;\n    }"));
edit('tests/prod/rls-bulk.ts', (s) => {
  s = rep(s, "transaction_date: d, description: 'Sample: live test'", "transaction_date: d + '22', description: 'Sample: live test'");
  s = rep(s, "const cleanup = await A.c.from('transactions').delete().eq('user_id', A.id).eq('request_id', realId);", "const cleanup = await A.c.from('transactions').delete().eq('user_id', A.id).in('request_id', [...ids, realId]);");
  return s;
});
