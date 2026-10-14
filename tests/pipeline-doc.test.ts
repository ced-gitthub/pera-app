import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const doc = fs.readFileSync('docs/APP-DEV-PIPELINE.md', 'utf8');
// Everything about gates lives between "## 7." and "## 8.": rule assertions are scoped to that slice, so text elsewhere cannot satisfy them.
const a7 = doc.indexOf('## 7. Stage gates and failure routing');
const a8 = doc.indexOf('## 8. Universal handoff format');
assert.ok(a7 >= 0 && a8 > a7, 'section 7 exists before section 8');
const section = doc.slice(a7, a8);

// One gate = from its heading to the next heading or the light-track paragraph, never to the end of the file.
const gate = (id: string) => {
  const a = section.indexOf(`### Gate ${id} `);
  assert.ok(a >= 0, `Gate ${id} exists`);
  const ends = ['\n### ', '\n**Light track.**', '\n## '].map((m) => section.indexOf(m, a + 5)).filter((i) => i > 0);
  return section.slice(a, ends.length ? Math.min(...ends) : undefined);
};
const checksPart = (g: string) => g.slice(g.indexOf('Checks'), g.indexOf('If it fails'));
const failPart = (g: string) => g.slice(g.indexOf('If it fails'));

test('there is a gate between every pair of stages (G1 to G4, then G5a before the push and G5b after it), each with checks and a failure route', () => {
  for (const id of ['G1', 'G2', 'G3', 'G4', 'G5a', 'G5b']) {
    const g = gate(id);
    assert.ok(g.includes('Checks'), `${id} checks`);
    assert.ok(g.includes('If it fails'), `${id} failure routing`);
  }
  for (const id of ['G1', 'G2', 'G3', 'G4', 'G5a', 'G5b'])
    assert.match(checksPart(gate(id)), /Instruction ledger/i, `${id} re-checks the instruction ledger`);
});

test('failures route to the right specialist agent', () => {
  assert.match(failPart(gate('G1')), /product-manager/);
  assert.match(failPart(gate('G2')), /ui-ux-designer/);
  assert.match(failPart(gate('G3')), /backend-devops-engineer/);
  assert.match(failPart(gate('G4')), /mobile-app-developer/);
  assert.match(failPart(gate('G4')), /backend-devops-engineer/);
  assert.match(failPart(gate('G5a')), /tester/);
  assert.match(failPart(gate('G5b')), /ci-watcher/);
});

test('the judge APPROVE is a CHECK at G3 and G5a (not only a failure route) for migrations, RLS, deletes, money, auth and deploy config', () => {
  for (const id of ['G3', 'G5a']) {
    const c = checksPart(gate(id));
    assert.match(c, /qa-engineer/, `${id} checks name qa-engineer`);
    assert.match(c, /APPROVE/, `${id} requires APPROVE`);
    for (const w of ['migration', 'RLS', 'delete', 'money', 'auth', 'deploy'])
      assert.ok(c.toLowerCase().includes(w.toLowerCase()), `${id} mentions ${w}`);
  }
});

test('nothing is pushed to main to turn a gate green: G5a stops and asks Ced, G5b runs after his yes', () => {
  const a = gate('G5a');
  assert.match(a, /ask Ced/i);
  assert.match(a, /push/i);
  assert.match(gate('G5b'), /after (Ced's|his) yes/i);
  assert.match(gate('G5b'), /ci-watcher/);
  assert.match(section, /light track[^.]*stops at G5a/i);
});

test('the rules that stop quality or instructions being left behind', () => {
  assert.match(section, /Instruction ledger/);
  assert.match(section, /verbatim/i);
  assert.match(section, /re-run the full gate/i);
  assert.match(section, /not only the failed check/i);
  assert.match(section, /re-open/i);
  assert.match(section, /Gate record/i);
});

test('the round limit cannot be dodged: rounds are counted per gate for the whole task, and a task may re-open earlier stages only once', () => {
  assert.match(section, /3 rounds per gate for the whole task/i);
  assert.match(section, /re-opens? do(es)? not reset/i);
  assert.match(section, /at most one re-open/i);
});

test('a deviation from an approved contract re-opens G3 instead of silently changing it', () => {
  assert.match(failPart(gate('G4')), /deviation[^.]*re-opens? G3/i);
});

test('light-track gate records are written down (PROGRESS.md) so the judge can read them', () => {
  assert.match(section, /Gate records[^.]*PROGRESS\.md/i);
});

test('rows deferred from G5a to the live run are proven at G5b, so no instruction ships unproven', () => {
  assert.match(checksPart(gate('G5a')), /deferred|needs the live run/i);
  assert.match(checksPart(gate('G5b')), /deferred/i);
  assert.match(checksPart(gate('G5b')), /Instruction ledger row/i);
});

test("the light track wording is consistent: G1 to G5a in the same turn, G5b after Ced's yes and the push", () => {
  assert.doesNotMatch(doc, /G1 to G5b still run/);
  assert.match(doc, /G1 to G5a/);
  assert.match(doc, /G5b runs after Ced's yes/i);
});

test("publishing the native APK needs the judge's APPROVE always (G5a) and an asset size check after upload (G5b)", () => {
  const a = checksPart(gate('G5a'));
  assert.match(a, /APK/);
  assert.match(a, /qa-engineer[^.·]*APPROVE[^.·]*(always|every)[^.·]*APK|APK[^.·]*qa-engineer[^.·]*APPROVE/i);
  const b = checksPart(gate('G5b'));
  assert.match(b, /native-0\.3/);
  assert.match(b, /asset size/i);
});

test('the ledger rule matches the gates: G5a proves each row or defers it, G5b proves every deferred row', () => {
  assert.match(section, /G5a proves each row[^.]*deferred/i);
  assert.match(section, /G5b proves every deferred row/i);
});

test('the APK asset size is checked right after any upload, whether or not anything was pushed to main', () => {
  assert.match(section, /right after any upload to `native-0\.3`[^.]*whether or not[^.]*pushed to `main`/i);
});

test('the five pipeline roles exist as real agents (.claude/agents) and the old reviewer/builder names are gone', () => {
  const roles = ['product-manager', 'ui-ux-designer', 'backend-devops-engineer', 'mobile-app-developer', 'qa-engineer'];
  for (const r of roles) {
    const f = `.claude/agents/${r}.md`;
    assert.ok(fs.existsSync(f), f);
    const body = fs.readFileSync(f, 'utf8');
    assert.match(body, new RegExp(`^name: ${r}$`, 'm'));
    assert.match(body, /docs\/CORRECTIONS\.md/); // every role reads the owner's corrections first
  }
  for (const old of ['judge', 'planner', 'builder', 'migrator'])
    assert.ok(!fs.existsSync(`.claude/agents/${old}.md`), `${old}.md is replaced`);
  const sec2 = doc.slice(doc.indexOf('## 2.'), doc.indexOf('## 3.'));
  for (const r of roles) assert.ok(sec2.includes(r), `section 2 names ${r}`);
  assert.doesNotMatch(doc, /\bjudge\b/i); // the pipeline's reviewer is the QA Engineer
  assert.match(fs.readFileSync('CLAUDE.md', 'utf8'), /qa-engineer/);
});
