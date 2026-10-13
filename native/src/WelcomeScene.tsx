import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import {
  floatersFor,
  headlineFor,
  moodIndex,
  parallaxShift,
  progressFraction,
  sceneStops,
  type Floater,
  type Step,
} from './welcomeSceneLogic';
import { c, r, s, sp, t } from './ui';

// The living page behind the welcome screen: drifting colour blobs, rising coins, a mood per mission, plus small touches (breathing hero, tile wiggle, input glow, tap ripple).
// All loops use the native driver, stop when the app is in the background, and never run with "reduce motion". Nothing here re-renders while typing.

export function useAppActive(): boolean {
  const [on, setOn] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setOn(st === 'active'));
    return () => sub.remove();
  }, []);
  return on;
}

// A value that loops 0 -> 1 -> 0 while `on`.
export function useLoop(on: boolean, ms: number): Animated.Value {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!on) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(a, { toValue: 0, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [on, ms, a]);
  return a;
}

const BLOBS = [
  { top: '-12%', left: '-30%', depth: 0.15, ms: 9000, pick: 0 },
  { top: '30%', left: '45%', depth: 0.3, ms: 11500, pick: 1 },
  { top: '70%', left: '-20%', depth: 0.45, ms: 13000, pick: 2 },
] as const;
const BLOB_SIZE = 320;
const SCROLL_RANGE = 1000;

function Blob({ spec, mood, scrollY, on }: { spec: (typeof BLOBS)[number]; mood: Animated.Value; scrollY: Animated.Value; on: boolean }) {
  const d = useLoop(on, spec.ms);
  const colors = sceneStops().blobs[spec.pick];
  const bg = mood.interpolate({ inputRange: [0, 1, 2], outputRange: colors });
  const shift = scrollY.interpolate({
    inputRange: [0, SCROLL_RANGE],
    outputRange: [0, parallaxShift(SCROLL_RANGE, spec.depth)],
    extrapolate: 'clamp',
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: spec.top,
        left: spec.left,
        width: BLOB_SIZE,
        height: BLOB_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [
          { translateY: shift },
          { translateX: d.interpolate({ inputRange: [0, 1], outputRange: [-30, 30] }) },
          { translateY: d.interpolate({ inputRange: [0, 1], outputRange: [20, -20] }) },
          { scale: d.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
        ],
      }}
    >
      <Animated.View
        style={{ position: 'absolute', width: BLOB_SIZE, height: BLOB_SIZE, borderRadius: r.pill, opacity: 0.16, backgroundColor: bg }}
      />
      <Animated.View
        style={{
          position: 'absolute',
          width: BLOB_SIZE * 0.6,
          height: BLOB_SIZE * 0.6,
          borderRadius: r.pill,
          opacity: 0.22,
          backgroundColor: bg,
        }}
      />
    </Animated.View>
  );
}

const RISE = 640;
function FloatingCoin({ f, on, scrollY }: { f: Floater; on: boolean; scrollY: Animated.Value }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!on) return;
    a.setValue(0);
    const run = Animated.sequence([
      Animated.delay(f.delay),
      Animated.loop(Animated.timing(a, { toValue: 1, duration: f.duration, easing: Easing.linear, useNativeDriver: true })),
    ]);
    run.start();
    return () => run.stop();
  }, [on, f, a]);
  const par = scrollY.interpolate({
    inputRange: [0, SCROLL_RANGE],
    outputRange: [0, parallaxShift(SCROLL_RANGE, 0.6)],
    extrapolate: 'clamp',
  });
  return (
    <Animated.Text
      style={{
        position: 'absolute',
        bottom: 0,
        left: `${f.leftPct}%`,
        fontSize: f.size === 'm' ? t.title : t.lead,
        opacity: a.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 0.6, 0.5, 0] }),
        transform: [
          { translateY: par },
          { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -RISE] }) },
          { translateX: a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, f.drift, 0] }) },
          { rotate: a.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '12deg'] }) },
        ],
      }}
    >
      {f.emoji}
    </Animated.Text>
  );
}

// Behind everything. The colours crossfade when the mission changes. With reduced motion it is one still colour.
export function SceneBackground({ step, reduce, scrollY }: { step: Step; reduce: boolean; scrollY: Animated.Value }) {
  const on = useAppActive();
  const idx = moodIndex(step);
  const stops = sceneStops();
  const mood = useRef(new Animated.Value(idx)).current;
  useEffect(() => {
    if (reduce) return mood.setValue(idx);
    const anim = Animated.timing(mood, { toValue: idx, duration: 1100, useNativeDriver: false }); // colours cannot use the native driver
    anim.start();
    return () => anim.stop();
  }, [idx, reduce, mood]);
  if (reduce) return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: stops.bg[idx] }]} />;
  const bg = mood.interpolate({ inputRange: stops.inputRange, outputRange: stops.bg });
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: bg, overflow: 'hidden' }]}>
      {BLOBS.map((b) => (
        <Blob key={b.pick} spec={b} mood={mood} scrollY={scrollY} on={on} />
      ))}
      {floatersFor(idx, false).map((f, i) => (
        <FloatingCoin key={`${idx}-${i}`} f={f} on={on} scrollY={scrollY} />
      ))}
    </Animated.View>
  );
}

// A thin bar across the top that fills as missions are reached.
export function ProgressTrack({ step, reduce }: { step: Step; reduce: boolean }) {
  const [w, setW] = useState(0);
  const f = useRef(new Animated.Value(progressFraction(step))).current;
  useEffect(() => {
    if (reduce) return f.setValue(progressFraction(step));
    const anim = Animated.timing(f, {
      toValue: progressFraction(step),
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [step, reduce, f]);
  return (
    <View
      accessible
      accessibilityLabel={`Progress: mission ${step} of 3`}
      onLayout={(ev) => setW(ev.nativeEvent.layout.width)}
      style={{ height: sp.xs, borderRadius: r.pill, backgroundColor: c.dim, overflow: 'hidden', marginBottom: sp.m }}
    >
      <Animated.View
        style={{
          height: sp.xs,
          backgroundColor: c.primary,
          transform: [{ translateX: f.interpolate({ inputRange: [0, 1], outputRange: [-w, 0] }) }],
        }}
      />
    </View>
  );
}

// The big headline: the words change with the mission and slide up as they swap.
export function HeadlineSwap({ step, reduce }: { step: Step; reduce: boolean }) {
  const a = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduce) return;
    a.setValue(0);
    const anim = Animated.spring(a, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [step, reduce, a]);
  return (
    <Animated.Text
      accessibilityRole="header"
      style={[
        s.h1,
        {
          marginTop: sp.xs,
          opacity: a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] }),
          transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        },
      ]}
    >
      {headlineFor(step)}
    </Animated.Text>
  );
}

type Badge = { level: number; title: string; emoji: string; xp: number };
// Level chip that pops in after mission 1 and bounces whenever XP goes up.
export function LevelBadge({ badge, reduce }: { badge: Badge | null; reduce: boolean }) {
  const a = useRef(new Animated.Value(0)).current;
  const xp = badge?.xp ?? 0;
  useEffect(() => {
    if (!xp) return;
    if (reduce) return a.setValue(1);
    a.setValue(0.6);
    const anim = Animated.spring(a, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [xp, reduce, a]);
  if (!badge) return null;
  return (
    <Animated.View
      accessible
      accessibilityLabel={`Level ${badge.level}, ${badge.title}, ${badge.xp} XP`}
      style={{
        alignSelf: 'flex-start',
        backgroundColor: c.reward,
        borderRadius: r.pill,
        paddingVertical: sp.xs,
        paddingHorizontal: sp.m,
        opacity: a,
        transform: [{ scale: a }],
      }}
    >
      <Text style={{ color: c.onReward, fontSize: t.caption, fontWeight: '800' }}>
        {`Level ${badge.level} · ${badge.title} ${badge.emoji} · ${badge.xp} XP`}
      </Text>
    </Animated.View>
  );
}
