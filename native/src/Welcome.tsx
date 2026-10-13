import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMinor, manilaToday } from '../../src/core/money';
import { runSandbox, sandboxNumbers, sandboxStep, SANDBOX_ACCOUNTS, SANDBOX_GOAL_MINOR, startSandbox } from './sandbox';
import { CountUp, XpPop } from './Motion';
import { Btn } from './Btn';
import { c, e, r, s, sp, t } from './ui';

// The first screen: a pretend wallet to play with BEFORE making an account. Three tiny missions, each one changes the numbers on screen.
const MISSIONS = {
  1: { title: 'Spend a little', text: 'Type what you spent, the way you would text a friend.', chip: 'lunch 150 gcash' },
  2: {
    title: 'Pay yourself first',
    text: 'Move some money to Savings. Watch what you can spend change.',
    chip: 'transfer 500 from gcash to savings',
  },
  3: { title: 'You are in control', text: 'That is the whole idea. No formulas, no tabs: type a line, see what is left.', chip: '' },
} as const;

export function Welcome({ onDone }: { onDone: (mode: 'signup' | 'login') => void }) {
  const { top, bottom } = useSafeAreaInsets();
  const [sb, setSb] = useState(startSandbox);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const [pop, setPop] = useState(0);
  const step = sandboxStep(sb);
  const n = sandboxNumbers(sb);
  const goalPct = Math.min(100, Math.floor((sb.balances.Savings * 100) / SANDBOX_GOAL_MINOR));
  const m = MISSIONS[step];
  const go = (line: string) => {
    const res = runSandbox(sb, line, manilaToday());
    if (!res.ok) return setMsg(res.message);
    setSb(res.state);
    setText('');
    setMsg('');
    setPop(Date.now());
  };
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: sp.l, paddingTop: top + sp.l, paddingBottom: bottom + sp.xxl }}
      >
        <Text style={{ color: c.reward, fontSize: t.body, fontWeight: '700' }}>ZOVIX · try it, no account needed</Text>
        <Text style={[s.h1, { marginTop: sp.xs }]}>Type a line. See what is left.</Text>

        <View style={{ backgroundColor: c.hero.violet, borderRadius: r.l, padding: sp.xl, marginVertical: sp.l }}>
          <Text style={{ color: c.mute, fontSize: t.body }}>You can spend</Text>
          <CountUp value={n.spendable} style={{ color: c.ink, fontSize: t.display, fontWeight: '800' }} />
          <Text style={{ color: c.reward, fontSize: t.body, marginTop: sp.s }}>🐷 Savings {formatMinor(n.savings)}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: sp.s, marginBottom: sp.l }}>
          {SANDBOX_ACCOUNTS.map((a) => (
            <View key={a.name} style={[s.card, { flex: 1, marginBottom: 0, padding: sp.m }]}>
              <Text style={{ color: c.mute, fontSize: t.caption }}>{a.saving ? '🐷 Savings' : a.name}</Text>
              <Text style={{ color: c.ink, fontSize: t.body, fontWeight: '800' }}>{formatMinor(sb.balances[a.name])}</Text>
            </View>
          ))}
        </View>

        <View style={[s.card, { borderColor: c.primary, borderWidth: 2 }]}>
          <Text style={{ color: c.primary, fontSize: t.caption, fontWeight: '800' }}>MISSION {step} OF 3</Text>
          <Text style={[s.h2, { marginTop: sp.xs }]}>{m.title}</Text>
          <Text style={[s.p, { marginBottom: sp.m }]}>{m.text}</Text>
          {step < 3 && (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Use the example ${m.chip}`}
                onPress={() => setText(m.chip)}
                style={[s.chip, { alignSelf: 'flex-start', marginBottom: sp.m }]}
              >
                <Text style={{ color: c.primary, fontSize: t.body }}>Tap to try: {m.chip}</Text>
              </Pressable>
              <TextInput
                style={s.input}
                value={text}
                onChangeText={setText}
                placeholder={m.chip}
                placeholderTextColor={c.mute}
                accessibilityLabel="Type an entry"
                maxLength={120}
                onSubmitEditing={() => go(text)}
                returnKeyType="done"
              />
              {!!msg && <Text style={s.err}>{msg}</Text>}
              <Btn label="Do it" onPress={() => go(text)} />
            </>
          )}
          {step === 3 && (
            <>
              <Text style={{ color: c.ink, fontSize: t.body, marginBottom: sp.s }}>🏆 New phone · {formatMinor(SANDBOX_GOAL_MINOR)}</Text>
              <View style={{ height: sp.m, borderRadius: r.pill, backgroundColor: c.raised, overflow: 'hidden' }}>
                <View style={{ height: sp.m, width: `${goalPct}%`, backgroundColor: c.reward }} />
              </View>
              <Text style={[s.p, { marginTop: sp.s }]}>
                {goalPct}% saved. Real goals fill from your real accounts, with levels, streaks and quests on top.
              </Text>
            </>
          )}
        </View>

        {step === 3 && <Btn label="Create my free account" onPress={() => onDone('signup')} />}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="I already have an account"
          onPress={() => onDone('login')}
          style={{ padding: sp.m }}
        >
          <Text style={{ color: c.mute, textAlign: 'center', fontSize: t.body }}>I already have an account</Text>
        </Pressable>
        <Text style={{ fontSize: e.s, textAlign: 'center' }}>{step === 3 ? '🎉' : '👆'}</Text>
      </ScrollView>
      <XpPop play={pop} label="+5 XP" />
    </View>
  );
}
