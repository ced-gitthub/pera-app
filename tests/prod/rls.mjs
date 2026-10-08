// Runs the RLS / constraint / aggregate suite against the real Supabase project (publishable key only).
import { G, T, done } from './lib.mjs';
process.env.SUITE = 'rls'; G('RLS + constraints + aggregates (real Supabase)');
process.env.QA_TOKEN = 'x'.repeat(24); process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL; process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const { GET } = await import('./rls-suite.ts');
const res = await GET(new Request('http://local/api/qa?token=' + process.env.QA_TOKEN)); const j = await res.json();
for (const line of j.results) T(line.replace(/^(PASS|FAIL) /, ''), line.startsWith('PASS'), line);
if (j.extra) console.log(JSON.stringify(j.extra));
const out = done({ extra: j.extra }); process.exit(out.fail ? 1 : 0);
