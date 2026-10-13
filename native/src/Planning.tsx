import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { formatMinor } from '../../src/core/money';
import { GOAL_EMOJIS } from '../../src/lib/goals';
import { minorToInput } from '../../src/lib/validate';
import type { Snapshot } from './data';
import { loadBudgets, loadGoals, type BudgetRow, type GoalRow } from './extra';
import { saveBudget, saveGoal, updateGoal } from './wizardData';
import { deleteBudget, deleteGoal } from './config';
import { Bar, Chip, Page, useList } from './Tabs';
import { Sheet } from './Sheet';
import { Btn } from './Btn';
import { CoachTarget } from './Coach';
import { c, s, sp, t } from './ui';

// Delete always asks first; the message says what is lost and what is kept.
const confirmDelete = (title: string, message: string, onYes: () => void) =>
  Alert.alert(title, message, [
    { text: 'Keep it', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onYes },
  ]);

function useSaver(after: () => Promise<void> | void) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async (f: () => Promise<string | null>) => {
    setBusy(true);
    setErr('');
    const m = await f().catch(() => 'Not saved: could not reach the server. Try again.');
    setBusy(false);
    if (m) setErr(m);
    else await after();
    return !m;
  };
  return { busy, err, setErr, run };
}

export function Budgets({ snap }: { snap: Snapshot }) {
  const l = useList(() => loadBudgets(snap), [snap]);
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState('');
  const [editing, setEditing] = useState<BudgetRow | null>(null);
  const [amount, setAmount] = useState('');
  const sv = useSaver(async () => {
    setOpen(false);
    await l.reload();
  });
  const edit = (b?: BudgetRow) => {
    setEditing(b ?? null);
    setCat(b?.categoryId ?? '');
    setAmount(b ? minorToInput(b.limit) : '');
    sv.setErr('');
    setOpen(true);
  };
  return (
    <>
      <Page
        emoji="🎯"
        title="Budgets"
        line="What is left to spend this month."
        tint={c.hero.plum}
        loading={l.rows === null}
        fab={{ label: '＋ New budget', onPress: () => edit() }}
        {...l}
      >
        {!!l.rows?.length && <Text style={[s.p, { marginBottom: sp.s }]}>Tap a budget to change or delete it.</Text>}
        {l.rows?.length === 0 && (
          <CoachTarget id="budgets:card" empty>
            <Text style={s.p}>No budgets this month. Tap New budget to set a limit for something you spend on.</Text>
          </CoachTarget>
        )}
        {l.rows?.map((b, i) => (
          <CoachTarget key={b.id} id="budgets:card" on={i === 0}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${b.name} budget`} onPress={() => edit(b)} style={s.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={s.h2}>{b.name}</Text>
                <Text style={{ color: b.over ? c.down : c.ink, fontWeight: '800', fontSize: t.body }}>
                  {b.over ? `Over by ${formatMinor(b.overBy)}` : `${formatMinor(b.left)} left`}
                </Text>
                <Text style={{ color: c.mute, fontSize: t.title }}> ›</Text>
              </View>
              <Bar pct={b.pct} color={b.over ? c.down : b.state === 'near' ? c.warn : c.up} />
              <Text style={s.p}>
                {formatMinor(b.spent)} of {formatMinor(b.limit)}
              </Text>
            </Pressable>
          </CoachTarget>
        ))}
      </Page>
      <Sheet open={open} title={editing ? `${editing.name} budget` : 'New budget'} onClose={() => setOpen(false)}>
        {!editing && (
          <>
            <Text style={s.p}>Spending on</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: sp.s }}>
              {snap.categories
                .filter((x) => x.type === 'expense')
                .map((x) => (
                  <Chip key={x.id} label={x.name} on={cat === x.id} press={() => setCat(x.id)} />
                ))}
            </View>
          </>
        )}
        <TextInput
          style={s.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="Monthly limit (₱)"
          placeholderTextColor={c.mute}
          accessibilityLabel="Monthly limit"
          keyboardType="decimal-pad"
        />
        {!!sv.err && <Text style={s.err}>{sv.err}</Text>}
        <Btn label="Save budget" busy={sv.busy} onPress={() => sv.run(() => saveBudget(cat, amount, snap))} />
        {editing && (
          <Btn
            label="Delete budget"
            danger
            onPress={() =>
              confirmDelete(`Delete the ${editing.name} budget?`, 'Your entries stay. Only the monthly limit is removed.', () =>
                sv.run(() => deleteBudget(editing.id)),
              )
            }
          />
        )}
      </Sheet>
    </>
  );
}

export function Goals({ snap }: { snap: Snapshot }) {
  const l = useList(() => loadGoals(snap), [snap]);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<GoalRow | null>(null);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(GOAL_EMOJIS[0]);
  const [amount, setAmount] = useState('');
  const [account, setAccount] = useState('');
  const sv = useSaver(async () => {
    setOpen(false);
    await l.reload();
  });
  const fresh = () => {
    setSel(null);
    setName('');
    setAmount('');
    setAccount('');
    sv.setErr('');
    setOpen(true);
  };
  return (
    <>
      <Page
        emoji="🏆"
        title="Goals"
        line="Watch them fill up."
        tint={c.hero.amber}
        loading={l.rows === null}
        fab={{ label: '＋ New goal', onPress: fresh }}
        {...l}
      >
        {!!l.rows?.length && <Text style={[s.p, { marginBottom: sp.s }]}>Tap a goal to change or delete it.</Text>}
        {l.rows?.length === 0 && (
          <CoachTarget id="goals:card" empty>
            <Text style={s.p}>No goals yet. Tap New goal: a phone, an emergency fund, anything.</Text>
          </CoachTarget>
        )}
        {l.rows?.map((g, i) => (
          <CoachTarget key={g.id} id="goals:card" on={i === 0}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${g.name} goal`}
              onPress={() => {
                setSel(g);
                setName(g.name);
                setEmoji(g.emoji);
                setAmount(minorToInput(g.target));
                setAccount(g.accountId);
                sv.setErr('');
                setOpen(true);
              }}
              style={s.card}
            >
              <Text style={s.h2}>
                {g.emoji} {g.name} {g.reached ? '🎉' : ''}
              </Text>
              <Bar pct={g.pct} color={g.reached ? c.up : c.reward} />
              <Text style={s.p}>
                {g.unavailable
                  ? 'Progress unavailable right now. Pull down to retry.'
                  : `${formatMinor(g.have)} of ${formatMinor(g.target)} · ${g.pct}%${g.reached ? '' : ` · ${formatMinor(g.remaining)} to go`}`}
              </Text>
            </Pressable>
          </CoachTarget>
        ))}
      </Page>
      <Sheet open={open} title={sel ? 'Edit goal' : 'New goal'} onClose={() => setOpen(false)}>
        <>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="Goal name, e.g. New phone"
            placeholderTextColor={c.mute}
            accessibilityLabel="Goal name"
            maxLength={40}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {GOAL_EMOJIS.map((x) => (
              <Chip key={x} label={x} on={emoji === x} press={() => setEmoji(x)} />
            ))}
          </View>
          <TextInput
            style={s.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="How much it costs (₱)"
            placeholderTextColor={c.mute}
            accessibilityLabel="Goal amount"
            keyboardType="decimal-pad"
          />
          <Text style={s.p}>Fill it from an account (optional)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: sp.s }}>
            {snap.accounts.map((a) => (
              <Chip key={a.id} label={a.name} on={account === a.id} press={() => setAccount(account === a.id ? '' : a.id)} />
            ))}
          </View>
          {!!sv.err && <Text style={s.err}>{sv.err}</Text>}
          <Btn
            label={sel ? 'Save changes' : 'Add goal'}
            busy={sv.busy}
            onPress={() =>
              sv.run(() =>
                sel ? updateGoal(sel.id, { name, emoji, amount, account }, snap) : saveGoal({ name, emoji, amount, account }, snap, true),
              )
            }
          />
          {sel && (
            <Btn
              label="Delete goal"
              danger
              onPress={() =>
                confirmDelete(`Delete "${sel.name}"?`, 'Your entries and accounts stay. Only this goal is removed.', () =>
                  sv.run(() => deleteGoal(sel.id)),
                )
              }
            />
          )}
        </>
      </Sheet>
    </>
  );
}
