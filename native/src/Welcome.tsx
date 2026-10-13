import { useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMinor, manilaToday } from '../../src/core/money';
import { runSandbox, sandboxNumbers, sandboxStep, SANDBOX_ACCOUNTS, SANDBOX_GOAL_MINOR, startSandbox } from './sandbox';
import { CountUp, XpPop } from './Motion';
import { Bob, ConfettiBurst, FadeSlideIn, FlashPulse, GrowBar, ProgressDots, Pulse, SwapIn, useReduceMotion } from './WelcomeMotion';
import { burstFor, type Burst } from './welcomeMotionLogic';
import { badgeFor, heroTint, xpGain } from './welcomeSceneLogic';
import { HeadlineSwap, LevelBadge, ProgressTrack, SceneBackground } from './WelcomeScene';
import { Breathe, GlowInput, TapFx, TintLayer, Wiggle } from './WelcomeTouch';
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
  const [pop, setPop] = useState({ id: 0, label: '' });
  const scrollY = useRef(new Animated.Value(0)).current;
  const [burst, setBurst] = useState<{ id: number; kind: Burst }>({ id: 0, kind: 'none' });
  const rm = useReduceMotion();
  const reduce = rm === true;
  const step = sandboxStep(sb);
  const n = sandboxNumbers(sb);
  const goalPct = Math.min(100, Math.floor((sb.balances.Savings * 100) / SANDBOX_GOAL_MINOR));
  const m = MISSIONS[step];
  const share = n.spendable + n.savings > 0 ? n.savings / (n.spendable + n.savings) : 0;
  const go = (line: string) => {
    const res = runSandbox(sb, line, manilaToday());
    if (!res.ok) return setMsg(res.message);
    setSb(res.state);
    setText('');
    setMsg('');
    const nextStep = sandboxStep(res.state);
    setPop({ id: Date.now(), label: `+${xpGain(step, sb.log.length, nextStep, res.state.log.length)} XP` });
    setBurst({ id: Date.now(), kind: burstFor(step, nextStep) });
  };
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SceneBackground step={step} reduce={reduce} scrollY={scrollY} />
      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: sp.l, paddingTop: top + sp.l, paddingBottom: bottom + sp.xxl }}
      >
        <FadeSlideIn index={0} reduce={rm}>
          <ProgressTrack step={step} reduce={reduce} />
          <Text style={{ color: c.reward, fontSize: t.body, fontWeight: '700' }}>ZOVIX · try it, no account needed</Text>
          <HeadlineSwap step={step} reduce={reduce} />
          <View style={{ minHeight: sp.xxl, justifyContent: 'center', marginTop: sp.s }}>
            <LevelBadge badge={badgeFor(step, sb.log.length)} reduce={reduce} />
          </View>
        </FadeSlideIn>

        <FadeSlideIn index={1} reduce={rm}>
          <Breathe reduce={reduce} style={{ marginVertical: sp.l }}>
            <FlashPulse value={n.spendable} reduce={reduce} style={{ backgroundColor: c.hero.violet, borderRadius: r.l, padding: sp.xl }}>
              <TintLayer tint={heroTint(share)} reduce={reduce} />
              <Text style={{ color: c.mute, fontSize: t.body }}>You can spend</Text>
              <CountUp value={n.spendable} style={{ color: c.ink, fontSize: t.display, fontWeight: '800' }} />
              <Text style={{ color: c.reward, fontSize: t.body, marginTop: sp.s }}>
                🐷 Savings <CountUp value={n.savings} style={{ color: c.reward, fontSize: t.body }} />
              </Text>
            </FlashPulse>
          </Breathe>
        </FadeSlideIn>

        <View style={{ flexDirection: 'row', gap: sp.s, marginBottom: sp.l }}>
          {SANDBOX_ACCOUNTS.map((a, i) => (
            <FadeSlideIn key={a.name} index={2 + i} reduce={rm} style={{ flex: 1 }}>
              <Wiggle value={sb.balances[a.name]} reduce={reduce}>
                <FlashPulse value={sb.balances[a.name]} reduce={reduce} style={[s.card, { marginBottom: 0, padding: sp.m }]}>
                  <Text style={{ color: c.mute, fontSize: t.caption }}>{a.saving ? '🐷 Savings' : a.name}</Text>
                  <CountUp value={sb.balances[a.name]} style={{ color: c.ink, fontSize: t.body, fontWeight: '800' }} />
                </FlashPulse>
              </Wiggle>
            </FadeSlideIn>
          ))}
        </View>

        <FadeSlideIn index={5} reduce={rm}>
          <SwapIn id={step} reduce={reduce} style={[s.card, { borderColor: c.primary, borderWidth: 2 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: c.primary, fontSize: t.caption, fontWeight: '800' }}>MISSION {step} OF 3</Text>
              <ProgressDots step={step} reduce={reduce} />
            </View>
            <Text style={[s.h2, { marginTop: sp.xs }]}>{m.title}</Text>
            <Text style={[s.p, { marginBottom: sp.m }]}>{m.text}</Text>
            {step < 3 && (
              <>
                <Pulse active={!reduce && text === ''} resetKey={step} style={{ alignSelf: 'flex-start', marginBottom: sp.m }}>
                  <TapFx reduce={reduce}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Use the example ${m.chip}`}
                      onPress={() => setText(m.chip)}
                      style={s.chip}
                    >
                      <Text style={{ color: c.primary, fontSize: t.body }}>Tap to try: {m.chip}</Text>
                    </Pressable>
                  </TapFx>
                </Pulse>
                <GlowInput
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
                <TapFx ripple reduce={reduce}>
                  <Btn label="Do it" onPress={() => go(text)} />
                </TapFx>
              </>
            )}
            {step === 3 && (
              <>
                <Text style={{ color: c.ink, fontSize: t.body, marginBottom: sp.s }}>🏆 New phone · {formatMinor(SANDBOX_GOAL_MINOR)}</Text>
                <GrowBar pct={goalPct} reduce={reduce} />
                <Text style={[s.p, { marginTop: sp.s }]}>
                  {goalPct}% saved. Real goals fill from your real accounts, with levels, streaks and quests on top.
                </Text>
              </>
            )}
          </SwapIn>
        </FadeSlideIn>

        {step === 3 && (
          <FadeSlideIn index={0} reduce={rm}>
            <Pulse active={!reduce} resetKey={step}>
              <TapFx ripple reduce={reduce}>
                <Btn label="Create my free account" onPress={() => onDone('signup')} />
              </TapFx>
            </Pulse>
          </FadeSlideIn>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="I already have an account"
          onPress={() => onDone('login')}
          style={{ padding: sp.m }}
        >
          <Text style={{ color: c.mute, textAlign: 'center', fontSize: t.body }}>I already have an account</Text>
        </Pressable>
        <Bob reduce={reduce}>
          <Text style={{ fontSize: e.s, textAlign: 'center' }}>{step === 3 ? '🎉' : '👆'}</Text>
        </Bob>
      </Animated.ScrollView>
      <XpPop play={pop.id} label={pop.label} />
      <ConfettiBurst burst={burst} reduce={reduce} />
    </View>
  );
}
