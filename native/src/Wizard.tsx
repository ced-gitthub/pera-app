import { useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Animated, ScrollView, Text, View } from 'react-native';
import { COPY, SAMPLES } from '../../src/lib/onboardingCopy';
import { GATE_STEPS, WIZARD_TOTAL, type GateStep } from '../../src/lib/onboarding';
import type { Snapshot } from './data';
import { HeaderClose } from './Sheet';
import { Btn } from './Btn';
import { confirmSignOut } from './signout';
import { useWizardAction } from './WizardAction';
import { c, s, sp, t, e, r } from './ui';

export type Slide = GateStep | 'finish';
const heroFor = (slide: Slide): string =>
  ({ first: c.hero.violet, balance: c.hero.teal, budget: c.hero.plum, goal: c.hero.amber, finish: c.hero.violet })[slide];
const ORDER: Slide[] = [...GATE_STEPS, 'finish'];

function Dots({ now, done }: { now: number; done: string[] }) {
  return (
    <View style={{ marginBottom: sp.m }}>
      <Text style={[s.p, { fontWeight: '700' }]}>
        Step {now} of {WIZARD_TOTAL}
      </Text>
      <View style={{ height: 8, borderRadius: r.pill, backgroundColor: c.line, marginVertical: sp.s, overflow: 'hidden' }}>
        <View style={{ height: 8, width: `${(now / WIZARD_TOTAL) * 100}%`, backgroundColor: c.primary }} />
      </View>
      <View style={{ flexDirection: 'row', gap: sp.s }}>
        {ORDER.map((id, i) => (
          <View
            key={id}
            style={{
              width: 12,
              height: 12,
              borderRadius: r.pill,
              backgroundColor: done.includes(id) || i < now - 1 ? c.up : i === now - 1 ? c.primary : c.line,
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
    <View style={[s.card, { borderColor: c.primary, borderWidth: 2 }]}>
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

// Full-screen and rendered INSTEAD of the app, so nothing behind it can be tapped or scrolled. The setup steps can be skipped (it is all in Settings, and replayable); Log out is always there.
// `slide` is the required step to do now, or 'finish'. `tour` = already set up: the same slides as Next / Back.
export function Wizard(p: {
  slide: Slide;
  doneIds: string[];
  snap: Snapshot;
  tour: boolean;
  refresh: () => Promise<string>;
  onFinish: () => void | Promise<void>;
  onBalances: () => Promise<boolean>;
  onSkip?: () => void | Promise<void>; // setup steps: leave the first-run steps for later
  onClose?: () => void; // the read-only walkthrough (tour mode) shows a pinned Close
  onUseSamples?: () => Promise<string | null>; // first step only: fill in labelled sample entries instead of typing one
}) {
  const [i, setI] = useState(0); // tour position
  const [finishing, setFinishing] = useState(false);
  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      await p.onFinish();
    } finally {
      setFinishing(false);
    }
  };
  const slide: Slide = p.tour ? ORDER[i] : p.slide;
  const number = p.tour ? i + 1 : Math.max(ORDER.indexOf(slide), 0) + 1;
  const c0 = COPY[slide];
  const { top, bottom } = useSafeAreaInsets();
  const slideIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    slideIn.setValue(0);
    Animated.spring(slideIn, { toValue: 1, useNativeDriver: true, friction: 7 }).start();
  }, [slide, slideIn]);
  const tint = heroFor(slide);
  const act = useWizardAction(slide === 'finish' ? null : slide, p.tour, p);
  return (
    <View style={{ flex: 1 }}>
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
          {p.tour && !!p.onClose && (
            <View style={{ alignItems: 'flex-end', marginBottom: sp.s }}>
              <HeaderClose label="Close" onPress={p.onClose} />
            </View>
          )}
          <View style={{ backgroundColor: c.card, borderRadius: r.s, padding: sp.m }}>
            <Dots now={number} done={p.tour ? ORDER.slice(0, i) : p.doneIds} />
          </View>
          <Animated.View
            style={{ opacity: slideIn, transform: [{ translateX: slideIn.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }] }}
          >
            <Text style={{ fontSize: e.m, marginTop: sp.m }}>{c0.emoji}</Text>
            <Text style={{ color: c.ink, fontSize: t.head, fontWeight: '800' }}>
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
              <Text style={[s.p, { marginBottom: sp.m }]}>
                Log it, track it, budget it, save for it. Everything is on your Home screen.
              </Text>
              <Text style={{ color: c.ink, marginBottom: sp.l }}>🔥 Tip: log something 3 days in a row to light your streak.</Text>
              <Btn label="Open my Zovix" busy={finishing} onPress={() => void finish()} />
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
                  {!p.onClose && !!p.onSkip && <Btn label="Skip" alt onPress={() => void p.onSkip?.()} />}
                </View>
              ) : (
                act.body
              )}
            </>
          )}
          {!p.tour && !!p.onSkip && <Btn label="Skip setup" alt onPress={() => void p.onSkip?.()} />}
          {!p.tour && <Btn label="Log out" alt onPress={confirmSignOut} />}
        </Animated.View>
      </ScrollView>
      {act.footer && <View style={{ paddingBottom: bottom }}>{act.footer}</View>}
    </View>
  );
}
