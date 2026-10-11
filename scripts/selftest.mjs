// Safety self-test: proves the project's guard rails actually work, so a typo can never silently switch one off.
// Run: npm run selftest. It also runs in CI and before every push to main.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

let failed = 0;
const ok = (name) => console.log('  ok   ' + name);
const bad = (name, why) => {
  failed++;
  console.log('  FAIL ' + name + (why ? ' - ' + why : ''));
};
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// 1) Names used for MCP tools in hook matchers / deny / ask rules must match a server in .mcp.json exactly (case matters).
const servers = Object.keys(read('.mcp.json').mcpServers ?? {});
const settings = read('.claude/settings.json');
const used = new Set();
const grab = (s) => {
  for (const m of String(s).matchAll(/mcp__([A-Za-z0-9_-]+?)__/g)) used.add(m[1]);
};
for (const group of Object.values(settings.hooks ?? {})) for (const g of group) grab(g.matcher ?? '');
for (const k of ['deny', 'ask']) for (const r of settings.permissions?.[k] ?? []) grab(r);
if (!used.size) bad('settings reference MCP servers', 'none found, expected the guard hook on supabase');
for (const u of used)
  servers.includes(u)
    ? ok(`MCP name "${u}" matches a server in .mcp.json`)
    : bad(`MCP name "${u}"`, `no server with that exact name in .mcp.json (have: ${servers.join(', ')})`);

// 2) The guard hook blocks what it promises to block, and lets normal work through.
const guard = (event) => spawnSync('node', ['.claude/hooks/guard.mjs'], { input: JSON.stringify(event), encoding: 'utf8' }).status;
const sql = (query, tool = 'mcp__supabase__execute_sql') => ({ tool_name: tool, tool_input: { query } });
const cases = [
  ['blocks DROP TABLE', sql('drop table transactions'), 2],
  ['blocks DROP TABLE via apply_migration', sql('drop table transactions', 'mcp__supabase__apply_migration'), 2],
  ['blocks DELETE without WHERE', sql('delete from transactions'), 2],
  ['blocks UPDATE without WHERE', sql('update accounts set name = 1'), 2],
  ['blocks TRUNCATE', sql('truncate transactions'), 2],
  [
    'blocks writing a secret key',
    { tool_name: 'Write', tool_input: { file_path: 'x.ts', content: 'const k = "sb_secret_' + 'a'.repeat(24) + '"' } },
    2,
  ],
  ['allows a normal SELECT', sql('select count(*) from transactions'), 0],
  ['allows DELETE with WHERE', sql("delete from transactions where id = 'x'"), 0],
  ['allows a normal file write', { tool_name: 'Write', tool_input: { file_path: 'x.ts', content: 'export const a = 1' } }, 0],
];
for (const [name, event, want] of cases) {
  const got = guard(event);
  got === want ? ok(name) : bad(name, `exit ${got}, wanted ${want}`);
}

// 3) Money and date rules the app depends on.
const { parseAmountMinor, isSaneDate } = await import('../src/core/money.ts');
parseAmountMinor('1.005') === null
  ? ok('amount with 3 decimals is refused (no float rounding)')
  : bad('amount with 3 decimals', 'accepted');
parseAmountMinor('12.34') === 1234 ? ok('amount is whole centavos') : bad('amount parsing');
!isSaneDate('2062-01-01', '2026-10-11') && isSaneDate('2026-10-11', '2026-10-11')
  ? ok('implausible dates are refused')
  : bad('date plausibility');

// 4) The install files must stay reachable while logged out, or the app cannot be installed.
const matcherSrc = fs.readFileSync('src/middleware.ts', 'utf8').match(/matcher: \['([^']+)'\]/)[1];
const matcher = new RegExp('^' + matcherSrc + '$');
for (const p of ['/manifest.webmanifest', '/pwa-icon/192', '/apple-icon', '/sw.js', '/offline.html', '/.well-known/assetlinks.json'])
  !matcher.test(p) ? ok('login check skips ' + p) : bad('login check skips ' + p, 'middleware would redirect it to /login');
matcher.test('/transactions') ? ok('app pages still go through the login check') : bad('app pages still go through the login check');

console.log(failed ? `\n${failed} safety check(s) FAILED` : '\nAll safety checks passed');
process.exit(failed ? 1 : 0);
