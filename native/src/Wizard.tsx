import { useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Animated, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { formatMinor } from '../../src/core/money';
import { minorToInput } from '../../src/lib/validate';
import { GOAL_EMOJIS } from '../../src/lib/goals';
import { COPY, SAMPLES } from '../../src/lib/onboardingCopy';
import { GATE_STEPS, WIZARD_TOTAL, type GateStep } from '../../src/lib/onboarding';
import { supabase } from './supabase';
import type { Snapshot } from './data';
import { saveBalances, saveBudget, saveGoal } from './wizardData';
import { QuickAdd } from './QuickAdd';
import { Btn } from './Btn';
import { c, s, sp, t, e, r } from './ui';

export type Slide = GateStep | 'finish';
const HERO: Record<Slide, string> = {
  first: c.hero.purple,
  balance: c.hero.green,
  budget: c.hero.orange,
  goal: c.hero.gold,
  finish: c.hero.purple,
};
const ORDER: Slide[] = [...GATE_STEPS, 'finish'];

function Dots({ now, done }: { now: number; done: string[] }) {
  return (
    <View style={{ marginBottom: sp.m }}>
      <Text style={[s.p, { fontWeight: '700' }]}>
        Step {now} of {WIZARD_TOTAL}
      </Text>
      <View style={{ height: 8, borderRadius: r.pill, backgroundColor: c.line, marginVertical: sp.s, overflow: 'hidden' }}>
        <View style={{ height: 8, width: `${(now / WIZARD_TOTAL) * 100}%`, backgroundColor: c.purple }} />
      </View>
      <View style={{ flexDirection: 'row', gap: sp.s }}>
        {ORDER.map((id, i) => (
          <View
            key={id}
            style={{
              width: 12,
              height: 12,
              borderRadius: r.pill,
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
      <Text style={[s.h2, { marginTop: sp.xs }]}>{x.you}</Text>
      <Text style={s.p}>What each part means</Text>
      {x.parts.map((p) => (
        <Text key={p.text} style={{ color: c.ink, marginTop: sp.s }}>
          <Text style={{ fontWeight: '800' }}>{p.text}</Text> — {p.what}
        </Text>
      ))}
      <Text style={[s.p, { marginTop: sp.s }]}>What Zovix does</Text>
      {x.result.map((r) => (
        <Text key={r} style={{ color: c.ink, marginTop: sp.xs }}>
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
  refresh: () => Promise<string>;
  onFinish: () => void;
  onBalances: () => Promise<boolean>;
}) {
  const [i, setI] = useState(0); // tour position
  const slide: Slide = p.tour ? ORDER[i] : p.slide;
  const number = p.tour ? i + 1 : Math.max(ORDER.indexOf(slide), 0) + 1;
  const c0 = COPY[slide];
  const { top, bottom } = useSafeAreaInsets();
  const slideIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    slideIn.setValue(0);
    Animated.spring(slideIn, { toValue: 1, useNativeDriver: true, friction: 7 }).start();
  }, [slide, slideIn]);
  const tint = HERO[slide];
  return (
    <ScrollView
      style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={{ paddingBottom: bottom + sp.xxl }}
    >
      <View
        style={{
          backgroundColor: tint,
          paddingTop: top + sp.l,
          paddingHorizontal: sp.l,
          paddingBottom: sp.xl,
          borderBottomLeftRadius: r.l,
          borderBottomRightRadius: r.l,
        }}
      >
        <View style={{ backgroundColor: c.glass, borderRadius: r.s, padding: sp.m }}>
          <Dots now={number} done={p.tour ? ORDER.slice(0, i) : p.doneIds} />
        </View>
        <Animated.View
          style={{ opacity: slideIn, transform: [{ translateX: slideIn.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }] }}
        >
          <Text style={{ fontSize: e.m, marginTop: sp.m }}>{c0.emoji}</Text>
          <Text style={{ color: c.white, fontSize: t.head, fontWeight: '800' }}>
            {slide === 'finish' ? (p.tour ? 'That is Zovix!' : c0.title) : c0.title}
          </Text>
        </Animated.View>
      </View>
      <Animated.View
        style={{
          padding: sp.l,
          opacity: slideIn,
          transform: [{ translateX: slideIn.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) }],
        }}
      >
        {slide === 'finish' ? (
          <View style={{ marginTop: sp.m }}>
            <Text style={[s.p, { marginBottom: sp.m }]}>Log it, track it, budget it, save for it. Everything is on your Home screen.</Text>
            <Text style={{ color: c.ink, marginBottom: sp.l }}>🔥 Tip: log something 3 days in a row to light your streak.</Text>
            <Btn label="Open my Zovix" onPress={p.onFinish} />
            {p.tour && <Btn label="Back" alt onPress={() => setI(i - 1)} />}
          </View>
        ) : (
          <>
            {c0.todo.map((t, k) => (
              <Text key={t} style={{ color: c.ink, marginTop: sp.s }}>
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
      </Animated.View>
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
  refresh: () => Promise<string>;
  onBalances: () => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async (f: () => Promise<string | null>, after?: () => Promise<boolean>) => {
    setBusy(true);
    setErr('');
    const e = await f().catch(() => 'Not saved: could not reach the server. Try again.');
    if (e) setErr(e);
    else if (after && !(await after())) setErr('Saved, but this phone could not remember the step. Try again.');
    else {
      setErr(await refresh()); // the gate re-reads real data and moves to the next slide; a failed re-read is shown, not hidden
    }
    setBusy(false);
  };
  const [bal, setBal] = useState<Record<string, string>>(() =>
    Object.fromEntries(snap.accounts.map((a) => [a.id, minorToInput(snap.balances[a.id] ?? 0)])),
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
        paddingVertical: sp.s,
        paddingHorizontal: sp.m,
        borderRadius: r.m,
        marginRight: sp.s,
        marginBottom: sp.s,
        backgroundColor: on ? c.purple : c.white,
        borderWidth: 1,
        borderColor: c.line,
      }}
    >
      <Text style={{ color: on ? c.white : c.ink }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={[s.card, { borderColor: c.yellow, borderWidth: 2, marginTop: sp.s }]}>
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
          <Btn label="Save balances" busy={busy} onPress={() => run(() => saveBalances(bal), onBalances)} />
        </>
      )}
      {step === 'budget' && (
        <>
          <Text style={s.p}>Spending on</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: sp.s }}>
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
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: sp.s }}>
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
