import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { burstParticles, dotsFilled, dur, flashDirection, staggerDelay, MAX_PARTICLES, type Burst, type Flash } from './welcomeMotionLogic';
import { c, r, sp, t } from './ui';

// Motion for the welcome screen. Everything here runs on the native driver where it can, never blocks typing, and switches off for "reduce motion".

// null = still asking the phone; true = person wants less motion.
export function useReduceMotion(): boolean | null {
  const [reduce, setReduce] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((v) => live && setReduce(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

// Fades and slides its children up the first time they show, one after another (index sets the order).
export function FadeSlideIn({
  index,
  reduce,
  style,
  children,
}: {
  index: number;
  reduce: boolean | null;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce === null) return; // wait until we know
    if (reduce) return a.setValue(1);
    const anim = Animated.timing(a, { toValue: 1, duration: dur(420, false), delay: staggerDelay(index, false), useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [reduce, index, a]);
  return (
    <Animated.View
      style={[style, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}
    >
      {children}
    </Animated.View>
  );
}

// Wraps a money block: when `value` changes it pops a little and glows lime (money in) or coral (money out), then settles.
export function FlashPulse({
  value,
  reduce,
  style,
  children,
}: {
  value: number;
  reduce: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const prev = useRef(value);
  const a = useRef(new Animated.Value(0)).current;
  const [dir, setDir] = useState<Flash>('none');
  useEffect(() => {
    const d = flashDirection(prev.current, value);
    prev.current = value;
    if (d === 'none' || reduce) return;
    setDir(d);
    a.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 140, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: 650, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [value, reduce, a]);
  const radius = StyleSheet.flatten(style)?.borderRadius;
  return (
    <Animated.View style={[style, { transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) }] }]}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            backgroundColor: dir === 'down' ? c.down : c.up,
            opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0, 0.3] }),
          },
        ]}
      />
    </Animated.View>
  );
}

// Slides and fades its children in from the right each time `id` changes (a new mission). Content swaps while invisible, so there is no flash.
export function SwapIn({
  id,
  reduce,
  style,
  children,
}: {
  id: number;
  reduce: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const a = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduce) return;
    a.setValue(0);
    const anim = Animated.spring(a, { toValue: 1, friction: 7, tension: 70, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [id, reduce, a]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: a.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
          transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [36, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// A gentle "tap me" pulse. Stops after a few beats, when `active` turns false, or with reduced motion.
export function Pulse({
  active,
  resetKey,
  style,
  children,
}: {
  active: boolean;
  resetKey: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    a.setValue(0);
    if (!active) return;
    const beat = Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: 520, useNativeDriver: true }),
      Animated.delay(1400),
    ]);
    const loop = Animated.loop(beat, { iterations: 5 });
    loop.start();
    return () => loop.stop();
  }, [active, resetKey, a]);
  return (
    <Animated.View style={[style, { transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }]}>
      {children}
    </Animated.View>
  );
}

// Up and down forever (a small hand or party emoji that invites a tap). Off with reduced motion.
export function Bob({ reduce, children }: { reduce: boolean; children: ReactNode }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return a.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(a, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, a]);
  return (
    <Animated.View
      style={{ alignItems: 'center', transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] }}
    >
      {children}
    </Animated.View>
  );
}

// Goal bar that grows to its percent instead of jumping (starts empty the first time it shows).
export function GrowBar({ pct, reduce }: { pct: number; reduce: boolean }) {
  const a = useRef(new Animated.Value(reduce ? pct : 0)).current;
  useEffect(() => {
    if (reduce) return a.setValue(pct);
    const anim = Animated.timing(a, { toValue: pct, duration: 900, delay: 250, useNativeDriver: false }); // width is layout, so no native driver
    anim.start();
    return () => anim.stop();
  }, [pct, reduce, a]);
  return (
    <View style={{ height: sp.m, borderRadius: r.pill, backgroundColor: c.raised, overflow: 'hidden' }}>
      <Animated.View
        style={{
          height: sp.m,
          backgroundColor: c.reward,
          width: a.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp' }),
        }}
      />
    </View>
  );
}

// Three dots for the three missions; each fills with a spring when you reach it.
export function ProgressDots({ step, reduce }: { step: 1 | 2 | 3; reduce: boolean }) {
  const vals = useRef([0, 1, 2].map((i) => new Animated.Value(i < dotsFilled(step) ? 1 : 0))).current;
  useEffect(() => {
    vals.forEach((v, i) => {
      const to = i < dotsFilled(step) ? 1 : 0;
      if (reduce) return v.setValue(to);
      Animated.spring(v, { toValue: to, friction: 4, tension: 120, useNativeDriver: true }).start();
    });
  }, [step, reduce, vals]);
  return (
    <View accessible accessibilityLabel={`Mission ${step} of 3`} style={{ flexDirection: 'row', gap: sp.xs }}>
      {vals.map((v, i) => (
        <View key={i} style={{ width: sp.m, height: sp.m, borderRadius: r.pill, backgroundColor: c.dim, overflow: 'hidden' }}>
          <Animated.View style={{ flex: 1, borderRadius: r.pill, backgroundColor: c.primary, opacity: v, transform: [{ scale: v }] }} />
        </View>
      ))}
    </View>
  );
}

// Emoji particles that fly out of the middle and fall away. Change `burst.id` to fire it again.
export function ConfettiBurst({ burst, reduce }: { burst: { id: number; kind: Burst }; reduce: boolean }) {
  const vals = useRef(Array.from({ length: MAX_PARTICLES }, () => new Animated.Value(0))).current;
  const parts = burstParticles(burst.kind, reduce);
  useEffect(() => {
    const list = burstParticles(burst.kind, reduce);
    if (!list.length) return;
    const anims = list.map((p, i) => {
      vals[i].setValue(0);
      return Animated.timing(vals[i], { toValue: 1, duration: 1000, delay: p.delay, useNativeDriver: true });
    });
    const all = Animated.parallel(anims);
    all.start();
    return () => all.stop();
  }, [burst, reduce, vals]);
  if (!parts.length) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: sp.clear * 2, left: 0, right: 0, alignItems: 'center' }}>
      {parts.map((p, i) => (
        <Animated.Text
          key={`${burst.id}-${i}`}
          style={{
            position: 'absolute',
            fontSize: p.size === 'm' ? t.title : t.lead,
            opacity: vals[i].interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateX: vals[i].interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
              { translateY: vals[i].interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, p.dy, p.dy + 70] }) },
              { rotate: vals[i].interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.rotate}deg`] }) },
              { scale: vals[i].interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.4, 1.15, 0.9] }) },
            ],
          }}
        >
          {p.emoji}
        </Animated.Text>
      ))}
    </View>
  );
}
