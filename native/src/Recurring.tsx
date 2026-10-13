import { useState, type ReactNode } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { formatMinor, manilaToday } from '../../src/core/money';
import { Btn } from './Btn';
import { newRequestId, type Snapshot } from './logic';
import { createRule, deleteRule, listRules, runDue, setRuleActive, type Rule } from './recurringApi';
import { FREQUENCIES, MAX_DESCRIPTION, MAX_RULES, describeRule, validateRule, type Frequency, type RuleForm } from './recurringLogic';
import { Sheet, ToggleRow } from './Sheet';
import { ListSkeleton } from './Skeleton';
import { Chip, useList } from './Tabs';
import { c, s, sp, t } from './ui';

const LABEL: Record<Frequency, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };

const blank = (snap: Snapshot): RuleForm => ({
  id: newRequestId(),
  type: 'expense',
  amount: '',
  description: '',
  accountId: snap.accounts[0]?.id ?? '',
  categoryId: snap.categories.find((x) => x.type === 'expense')?.id ?? '',
  frequency: 'monthly',
  interval: '1',
  start: manilaToday(),
});

const Label = ({ children }: { children: string }) => <Text style={s.p}>{children}</Text>;
const Wrap = ({ children }: { children: ReactNode }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: sp.s }}>{children}</View>
);

// Rules that add an entry for you on a schedule (rent, subscriptions, salary). Shown inside a sheet.
export function Recurring({ snap, onClose, onChanged }: { snap: Snapshot; onClose: () => void; onChanged: () => void }) {
  const l = useList(listRules, []);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState<RuleForm>(() => blank(snap));
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [working, setWorking] = useState('');
  const rules = l.rows ?? [];
  const full = rules.length >= MAX_RULES;
  const acc = (id: string) => snap.accounts.find((a) => a.id === id)?.name ?? 'Account';
  const cat = (id: string) => snap.categories.find((x) => x.id === id)?.name ?? 'Category';
  const set = (p: Partial<RuleForm>) => setF((x) => ({ ...x, ...p }));
  const setType = (type: 'income' | 'expense') => set({ type, categoryId: snap.categories.find((x) => x.type === type)?.id ?? '' });

  async function save() {
    setMsg('');
    const v = validateRule(f, snap);
    if (!v.ok) return setErr(v.message);
    setSaving(true);
    const e = await createRule(v.row);
    setSaving(false);
    if (e) return setErr(e);
    setErr('');
    setMsg('Rule added. Press "Run due now" to add anything already due.');
    setAdding(false);
    setF(blank(snap)); // a fresh id for the next rule
    l.reload();
    onChanged();
  }

  async function change(id: string, job: () => Promise<string | null>) {
    setWorking(id);
    const e = await job();
    setWorking('');
    setMsg('');
    setErr(e ?? '');
    if (!e) {
      l.reload();
      onChanged();
    }
  }

  function remove(r: Rule) {
    Alert.alert('Delete this rule?', 'Entries it already made stay.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => change(r.id, () => deleteRule(r.id)) },
    ]);
  }

  async function run() {
    setRunning(true);
    const x = await runDue();
    setRunning(false);
    setErr(x.error ?? '');
    setMsg(x.error ? '' : x.created === 0 ? 'Nothing was due.' : `Added ${x.created} ${x.created === 1 ? 'entry' : 'entries'}.`);
    if (!x.error) {
      l.reload();
      if (x.created > 0) onChanged();
    }
  }

  const cats = snap.categories.filter((x) => x.type === f.type);
  return (
    <Sheet open title="Recurring" onClose={onClose}>
      <Text style={s.p}>Rules add an entry for you on a schedule, like rent or salary.</Text>
      {!!err && <Text style={s.err}>{err}</Text>}
      {!!msg && <Text style={s.ok}>{msg}</Text>}

      {l.rows === null && !l.err && <ListSkeleton rows={3} />}
      {!!l.err && (
        <>
          <Text style={s.err}>{l.err}</Text>
          <Btn label="Try again" onPress={l.reload} busy={l.busy} />
        </>
      )}
      {l.rows !== null && rules.length === 0 && !adding && (
        <Text style={[s.p, { marginVertical: sp.l }]}>No recurring rules yet. Add one for rent, a subscription or your salary.</Text>
      )}
      {rules.map((r) => (
        <View key={r.id} style={s.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ flex: 1, color: c.ink, fontWeight: '700', fontSize: t.body }}>{r.description || cat(r.category_id)}</Text>
            <Text style={{ color: r.type === 'income' ? c.up : c.down, fontWeight: '800', fontSize: t.body }}>
              {r.type === 'income' ? '+' : '-'}
              {formatMinor(r.amount_minor)}
            </Text>
          </View>
          <Text style={{ color: c.mute, fontSize: t.caption }}>{describeRule(r)}</Text>
          <Text style={{ color: c.mute, fontSize: t.caption }}>
            {cat(r.category_id)} · {acc(r.account_id)} · {r.active ? `Next: ${r.next_run_date}` : 'Paused'}
          </Text>
          <ToggleRow
            label={r.active ? 'Running' : 'Paused'}
            hint={r.active ? 'Turn off to pause.' : 'Turn on to resume. Dates missed while paused are skipped.'}
            on={r.active}
            busy={working === r.id}
            onChange={(on) => change(r.id, () => setRuleActive(r.id, on))}
          />
          <Btn label="Delete" alt busy={working === r.id} onPress={() => remove(r)} />
        </View>
      ))}

      {!adding && l.rows !== null && (
        <>
          {full && <Text style={s.err}>You have {MAX_RULES} rules, the most allowed. Delete one to add another.</Text>}
          {!full && snap.accounts.length === 0 && <Text style={s.err}>Add an account first, then you can make a rule.</Text>}
          {!full && snap.accounts.length > 0 && <Btn label="New rule" onPress={() => setAdding(true)} />}
          {rules.length > 0 && <Btn label="Run due now" alt busy={running} onPress={run} />}
        </>
      )}

      {adding && (
        <View style={s.card}>
          <Text style={s.h2}>New rule</Text>
          <Wrap>
            <Chip label="Money out" on={f.type === 'expense'} press={() => setType('expense')} />
            <Chip label="Money in" on={f.type === 'income'} press={() => setType('income')} />
          </Wrap>
          <Label>Amount</Label>
          <TextInput
            style={s.input}
            value={f.amount}
            onChangeText={(v) => set({ amount: v })}
            placeholder="15000"
            placeholderTextColor={c.mute}
            keyboardType="decimal-pad"
            accessibilityLabel="Amount in pesos"
            maxLength={16}
          />
          <Label>What is it for (optional)</Label>
          <TextInput
            style={s.input}
            value={f.description}
            onChangeText={(v) => set({ description: v })}
            placeholder="Rent"
            placeholderTextColor={c.mute}
            accessibilityLabel="Description"
            maxLength={MAX_DESCRIPTION + 20}
          />
          <Label>Account</Label>
          <Wrap>
            {snap.accounts.map((a) => (
              <Chip key={a.id} label={a.name} on={f.accountId === a.id} press={() => set({ accountId: a.id })} />
            ))}
          </Wrap>
          <Label>Category</Label>
          <Wrap>
            {cats.length === 0 && <Text style={s.p}>You have no {f.type} categories yet.</Text>}
            {cats.map((x) => (
              <Chip key={x.id} label={x.name} on={f.categoryId === x.id} press={() => set({ categoryId: x.id })} />
            ))}
          </Wrap>
          <Label>How often</Label>
          <Wrap>
            {FREQUENCIES.map((q) => (
              <Chip key={q} label={LABEL[q]} on={f.frequency === q} press={() => set({ frequency: q })} />
            ))}
          </Wrap>
          <Label>Repeat every (1 to 365)</Label>
          <TextInput
            style={s.input}
            value={f.interval}
            onChangeText={(v) => set({ interval: v })}
            keyboardType="number-pad"
            accessibilityLabel="Repeat every, a number from 1 to 365"
            maxLength={3}
          />
          <Label>First date (YYYY-MM-DD)</Label>
          <TextInput
            style={s.input}
            value={f.start}
            onChangeText={(v) => set({ start: v })}
            placeholder="2026-11-01"
            placeholderTextColor={c.mute}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="First date, year-month-day"
            maxLength={10}
          />
          <Text style={[s.p, { marginBottom: sp.m }]}>A date in the past adds the missed entries when the rule runs.</Text>
          <Btn label="Save rule" busy={saving} onPress={save} />
          <Btn
            label="Cancel"
            alt
            onPress={() => {
              setAdding(false);
              setErr('');
            }}
          />
        </View>
      )}
    </Sheet>
  );
}
