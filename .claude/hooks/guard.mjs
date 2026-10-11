// PreToolUse guard. Reads the tool call as JSON on stdin; exit 2 blocks it and the message goes back to Claude.
// 1) never write secret-looking values  2) never edit an already-committed migration  3) block destructive SQL sent to Supabase.
import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
let ev = {}; try { ev = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }
const tool = ev.tool_name || '', inp = ev.tool_input || {}, deny = m => { console.error('Blocked by .claude/hooks/guard.mjs: ' + m); process.exit(2); };
const SECRET = /sb_secret_[A-Za-z0-9_-]{20,}|sbp_[a-f0-9]{30,}|eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/;
if (/^(Write|Edit|MultiEdit)$/.test(tool)) {
  const text = [inp.content, inp.new_string, ...(inp.edits || []).map(e => e.new_string)].filter(Boolean).join('\n'), file = String(inp.file_path || '');
  if (SECRET.test(text)) deny('the content looks like a secret/key. Use environment variables and never commit credentials.');
  if (/(^|\/)supabase\/migrations\/[^/]+\.sql$/.test(file) && fs.existsSync(file)) {
    let tracked = false; try { execFileSync('git', ['ls-files', '--error-unmatch', file], { stdio: 'ignore' }); tracked = true; } catch {}
    if (tracked) deny(`${file} is already committed (assume applied). Add a new migration instead of editing it.`);
  }
}
if (/^mcp__supabase__(apply_migration|execute_sql)$/i.test(tool)) { // the server is named "supabase" in .mcp.json; match any case so a typo can never disable this guard
  const sql = String(inp.query || '').replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' '), low = sql.toLowerCase();
  if (/\bdrop\s+(table|schema|database|column)\b/.test(low) || /\balter\s+table\b[^;]*\bdrop\s+column\b/.test(low)) deny('destructive DDL (drop table/schema/database/column). Ask the user to confirm and run it themselves.');
  if (/\btruncate\b/.test(low) || /\bdrop\s+owned\b|\balter\s+role\b|\bdrop\s+role\b/.test(low)) deny('truncate/role changes are not allowed from the agent.');
  for (const s of low.split(';')) { const t = s.trim(); if (/^(delete\s+from|update)\b/.test(t) && !/\bwhere\b/.test(t)) deny('DELETE/UPDATE without WHERE. Add a WHERE clause (or ask the user to confirm a bulk change).'); }
}
process.exit(0);
