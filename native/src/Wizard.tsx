import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { formatMinor } from '../../src/core/money';
import { GOAL_EMOJIS } from '../../src/lib/goals';
import { COPY, SAMPLES } from '../../src/lib/onboardingCopy';
import { GATE_STEPS, WIZARD_TOTAL, type GateStep } from '../../src/lib/onboarding';
import { supabase } from './supabase';
import type { Snapshot } from './data';
import { saveBalances, saveBudget, saveGoal } from './wizardData';
import { QuickAdd } from './QuickAdd';
import { Btn } from './Btn';
import { c, s } from './ui';

export type Slide = GateStep | 'finish';
const ORDER: Slide[] = [...GATE_STEPS, 'finish'];

function Dots({ now, done }: { now: number; done: string[] }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[s.p, { fontWeight: '700' }]}>
        Step {now} of {WIZARD_TOTAL}
      </Text>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: c.line, marginVertical: 8, overflow: 'hidden' }}>
        <View style={{ height: 8, width: `${(now / WIZARD_TOTAL) * 100}%`, backgroundColor: c.purple }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {ORDER.map((id, i) => (
          <View
            key={id}
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: done.includes(id) || i < now - 1 ? c.green : i === now - 1 ? c.purple : c.line,
            }}
          />
        ))}
      </View>
    </View>
  );
}

function SampleBox({ step }: { step: GateStep }) {
  const x = SAMPLES[step];
  return (
    <View style={[s.card, { borderColor: c.yellow, borderWidth: 2 }]}>
      <Text style={s.p}>You type</Text>
      <Text style={[s.h2, { marginTop: 4 }]}>{x.you}</Text>
      <Text style={s.p}>What each part means</Text>
      {x.parts.map((p) => (
        <Text key={p.text} style={{ color: c.ink, marginTop: 6 }}>
          <Text style={{ fontWeight: '800' }}>{p.text}</Text> — {p.what}
        </Text>
      ))}
      <Text style={[s.p, { marginTop: 10 }]}>What Zovix does</Text>
      {x.result.map((r) => (
        <Text key={r} style={{ color: c.ink, marginTop: 4 }}>
          • {r}
        </Text>
      ))}
    </View>
  );
}

// Full-screen and rendered INSTEAD of the app, so nothing behind it can be tapped or scrolled. There is no Skip; only Log out.
// `slide` is the required step to do now, or 'finish'. `tour` = already set up: the same slides as Next / Back.
export function Wizard(p: {
  slide: Slide;
  doneIds: string[];
  snap: Snapshot;
  tour: boolean;
  refresh: () => Promise<void>;
  onFinish: () => void;
  onBalances: () => void;
}) {
  const [i, setI] = useState(0); // tour position
  const slide: Slide = p.tour ? ORDER[i] : p.slide;
  const number = p.tour ? i + 1 : Math.max(ORDER.indexOf(slide), 0) + 1;
  const c0 = COPY[slide];
  return (
    <ScrollView style={s.screen} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 60 }}>
      <Dots now={number} done={p.tour ? ORDER.slice(0, i) : p.doneIds} />
      <Text style={{ fontSize: 44 }}>{c0.emoji}</Text>
      <Text style={s.h1}>{slide === 'finish' ? (p.tour ? 'That is Zovix!' : c0.title) : c0.title}</Text>
      {slide === 'finish' ? (
        <View style={{ marginTop: 12 }}>
          <Text style={[s.p, { marginBottom: 12 }]}>Log it, track it, budget it, save for it. Everything is on your Home screen.</Text>
          <Text style={{ color: c.ink, marginBottom: 16 }}>🔥 Tip: log something 3 days in a row to light your streak.</Text>
          <Btn label="Open my Zovix" onPress={p.onFinish} />
          {p.tour && <Btn label="Back" alt onPress={() => setI(i - 1)} />}
        </View>
      ) : (
        <>
          {c0.todo.map((t, k) => (
            <Text key={t} style={{ color: c.ink, marginTop: 6 }}>
              {k + 1}. {t}
            </Text>
          ))}
          <View style={{ height: 12 }} />
          <SampleBox step={slide} />
          {p.tour ? (
            <View>
              <Btn label="Next" onPress={() => setI(i + 1)} />
              {i > 0 && <Btn label="Back" alt onPress={() => setI(i - 1)} />}
            </View>
          ) : (
            <Action step={slide} {...p} />
          )}
        </>
      )}
      {!p.tour && <Btn label="Log out" alt onPress={() => supabase.auth.signOut()} />}
    </ScrollView>
  );
}

function Action({
  step,
  snap,
  refresh,
  onBalances,
}: {
  step: GateStep;
  snap: Snapshot;
  refresh: () => Promise<void>;
  onBalances: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async (f: () => Promise<string | null>, after?: () => void) => {
    setBusy(true);
    setErr('');
    const e = await f().catch(() => 'Not saved: could not reach the server. Try again.');
    if (e) setErr(e);
    else {
      after?.();
      await refresh(); // the gate re-reads real data and moves to the next slide
    }
    setBusy(false);
  };
  const [bal, setBal] = useState<Record<string, string>>(() =>
    Object.fromEntries(snap.accounts.map((a) => [a.id, snap.balances[a.id] ? (snap.balances[a.id] / 100).toFixed(2) : ''])),
  );
  const [cat, setCat] = useState('');
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(GOAL_EMOJIS[0]);
  const [account, setAccount] = useState('');
  const field = (v: string, set: (x: string) => void, label: string, kb: 'default' | 'decimal-pad' = 'default') => (
    <TextInput style={s.input} value={v} onChangeText={set} placeholder={label} accessibilityLabel={label} keyboardType={kb} />
  );
  const chip = (label: string, on: boolean, press: () => void) => (
    <Pressable
      key={label}
      onPress={press}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 20,
        marginRight: 8,
        marginBottom: 8,
        backgroundColor: on ? c.purple : '#fff',
        borderWidth: 1,
        borderColor: c.line,
      }}
    >
      <Text style={{ color: on ? '#fff' : c.ink }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={[s.card, { borderColor: c.yellow, borderWidth: 2, marginTop: 8 }]}>
      <Text style={[s.h2, { color: c.purple }]}>👉 Start here</Text>
      {step === 'first' && <QuickAdd snap={snap} onSaved={refresh} />}
      {step === 'balance' && (
        <>
          {snap.accounts.map((a) => (
            <View key={a.id}>
              <Text style={s.p}>{a.name} (₱)</Text>
              {field(bal[a.id] ?? '', (x) => setBal({ ...bal, [a.id]: x }), `${a.name} balance`, 'decimal-pad')}
            </View>
          ))}
          <Btn label="Save balances" busy={busy} onPress={() => run(() => saveBalances(bal, snap), onBalances)} />
        </>
      )}
      {step === 'budget' && (
        <>
          <Text style={s.p}>Spending on</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
            {snap.categories.filter((x) => x.type === 'expense').map((x) => chip(x.name, cat === x.id, () => setCat(x.id)))}
          </View>
          {field(amount, setAmount, 'Monthly limit (₱)', 'decimal-pad')}
          <Btn label="Set budget" busy={busy} onPress={() => run(() => saveBudget(cat, amount, snap))} />
        </>
      )}
      {step === 'goal' && (
        <>
          {field(name, setName, 'Goal name, e.g. New phone')}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{GOAL_EMOJIS.map((e) => chip(e, emoji === e, () => setEmoji(e)))}</View>
          {field(amount, setAmount, 'How much it costs (₱)', 'decimal-pad')}
          <Text style={s.p}>Connect to an account (optional)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
            {snap.accounts.map((a) => chip(a.name, account === a.id, () => setAccount(account === a.id ? '' : a.id)))}
          </View>
          <Btn label="Add goal" busy={busy} onPress={() => run(() => saveGoal({ name, emoji, amount, account }, snap))} />
        </>
      )}
      {!!err && <Text style={s.err}>{err}</Text>}
      {step === 'balance' && <Text style={s.p}>Now: {formatMinor(Object.values(snap.balances).reduce((a, b) => a + b, 0))}</Text>}
    </View>
  );
}
