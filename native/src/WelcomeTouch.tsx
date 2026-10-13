import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { useAppActive, useLoop } from './WelcomeScene';
import { c, r, s, sp } from './ui';

// Small touches for the welcome screen: a breathing hero card, a tint that follows Savings, tile wiggle, a glowing input and a press/ripple wrapper.
// Native driver wherever a colour is not involved; all of it is off with reduced motion.

// Gentle scale pulse for the hero card.
export function Breathe({ reduce, style, children }: { reduce: boolean; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const active = useAppActive();
  const a = useLoop(active && !reduce, 2600);
  return (
    <Animated.View style={[style, { transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] }) }] }]}>
      {children}
    </Animated.View>
  );
}

// A tint layer inside the hero card: violet at the start, teal as Savings grows.
export function TintLayer({ tint, reduce }: { tint: number; reduce: boolean }) {
  const a = useRef(new Animated.Value(tint)).current;
  useEffect(() => {
    if (reduce) return a.setValue(tint);
    const anim = Animated.timing(a, { toValue: tint, duration: 900, useNativeDriver: false });
    anim.start();
    return () => anim.stop();
  }, [tint, reduce, a]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: r.l, backgroundColor: a.interpolate({ inputRange: [0, 1], outputRange: [c.hero.violet, c.hero.teal] }) },
      ]}
    />
  );
}

// A quick shake when `value` changes.
export function Wiggle({
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
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    if (reduce) return;
    const to = (v: number) => Animated.timing(a, { toValue: v, duration: 70, useNativeDriver: true });
    const anim = Animated.sequence([to(1), to(-1), to(0.6), to(-0.6), to(0)]);
    anim.start();
    return () => anim.stop();
  }, [value, reduce, a]);
  return (
    <Animated.View style={[style, { transform: [{ rotate: a.interpolate({ inputRange: [-1, 1], outputRange: ['-3deg', '3deg'] }) }] }]}>
      {children}
    </Animated.View>
  );
}

// The text box lights up lime while it has focus (native-driven overlay, so typing is never slowed).
export function GlowInput(props: TextInputProps) {
  const a = useRef(new Animated.Value(0)).current;
  const to = (v: number) => Animated.timing(a, { toValue: v, duration: 180, useNativeDriver: true }).start();
  return (
    <View style={{ marginBottom: sp.m }}>
      <TextInput
        {...props}
        style={[s.input, { marginBottom: 0 }]}
        onFocus={(ev) => {
          to(1);
          props.onFocus?.(ev);
        }}
        onBlur={(ev) => {
          to(0);
          props.onBlur?.(ev);
        }}
      />
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderWidth: 2, borderColor: c.primary, borderRadius: r.s, opacity: a }]}
      />
    </View>
  );
}

// Press feel for anything tappable: it shrinks a touch while held, and (for the main button) a ripple spreads from the middle.
export function TapFx({
  ripple,
  reduce,
  style,
  children,
}: {
  ripple?: boolean;
  reduce: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const sc = useRef(new Animated.Value(1)).current;
  const rp = useRef(new Animated.Value(0)).current;
  const press = (down: boolean) => {
    if (reduce) return;
    Animated.spring(sc, { toValue: down ? 0.97 : 1, friction: 6, tension: 220, useNativeDriver: true }).start();
  };
  return (
    <Animated.View
      onTouchStart={() => {
        press(true);
        if (ripple && !reduce) {
          rp.setValue(0);
          Animated.timing(rp, { toValue: 1, duration: 550, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
        }
      }}
      onTouchEnd={() => press(false)}
      onTouchCancel={() => press(false)}
      style={[style, { transform: [{ scale: sc }] }, ripple && { overflow: 'hidden', borderRadius: r.s }]}
    >
      {children}
      {ripple && !reduce && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Animated.View
            style={{
              width: 120,
              height: 120,
              borderRadius: r.pill,
              backgroundColor: c.ink,
              opacity: rp.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.35, 0] }),
              transform: [{ scale: rp.interpolate({ inputRange: [0, 1], outputRange: [0.2, 3.5] }) }],
            }}
          />
        </Animated.View>
      )}
    </Animated.View>
  );
}
