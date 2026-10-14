import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const doc = fs.readFileSync('docs/APP-DEV-PIPELINE.md', 'utf8');
const gate = (n: number) => {
  const a = doc.indexOf(`### Gate G${n}`);
  assert.ok(a >= 0, `Gate G${n} exists`);
  const b = doc.indexOf('\n### ', a + 5);
  return doc.slice(a, b < 0 ? undefined : b);
};

test('the pipeline has a gate between every pair of stages, G1 to G5, each with checks and a failure route', () => {
  assert.match(doc, /## 7\. Stage gates and failure routing/);
  for (let n = 1; n <= 5; n++) {
    const g = gate(n);
    assert.match(g, /Checks/i, `G${n} checks`);
    assert.match(g, /If it fails/i, `G${n} failure routing`);
    assert.match(g, /Instruction ledger/i, `G${n} re-checks the instruction ledger`);
  }
});

test('failures route to the right specialist agent', () => {
  assert.match(gate(1), /planner/);
  assert.match(gate(2), /design:/);
  assert.match(gate(3), /migrator/);
  assert.match(gate(3), /judge/);
  assert.match(gate(4), /builder/);
  assert.match(gate(5), /tester/);
  assert.match(gate(5), /ci-watcher/);
  assert.match(gate(5), /judge/);
});

test('the rules that stop quality or instructions being left behind', () => {
  assert.match(doc, /Instruction ledger/);
  assert.match(doc, /verbatim/i); // Ced's own words are kept
  assert.match(doc, /re-run the full gate/i);
  assert.match(doc, /not only the failed check/i);
  assert.match(doc, /3 rounds/i); // a gate that keeps failing stops and tells Ced
  assert.match(doc, /re-open/i); // a fix routed to an earlier stage re-opens it and the later gates it touches
  assert.match(doc, /light track/i);
  assert.match(doc, /Gate record/i);
});
