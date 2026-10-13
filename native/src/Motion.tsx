import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Text, type TextStyle } from 'react-native';
import { formatMinor } from '../../src/core/money';
import { c, sp, t, r } from './ui';

// A money figure that counts to its new value (about 0.6 s). Works in whole centavos only; with reduced motion it just shows the new value.
export function CountUp({ value, style }: { value: number; style?: TextStyle }) {
  const v = useRef(new Animated.Value(value)).current;
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const id = v.addListener(({ value: x }) => setShown(Math.round(x)));
    return () => v.removeListener(id);
  }, [v]);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (!live) return;
        if (reduce) {
          v.setValue(value);
          setShown(value);
        } else Animated.timing(v, { toValue: value, duration: 600, useNativeDriver: false }).start();
      });
    return () => {
      live = false;
    };
  }, [value, v]);
  return (
    <Text accessibilityLabel={formatMinor(value)} style={style}>
      {formatMinor(shown)}
    </Text>
  );
}

// A badge like "+5 XP" that pops up and fades. Change `play` (any new number) to trigger it.
export function XpPop({ play, label }: { play: number; label: string }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!play) return;
    a.setValue(0);
    Animated.sequence([
      Animated.spring(a, { toValue: 1, useNativeDriver: true, friction: 5 }),
      Animated.timing(a, { toValue: 0, duration: 700, delay: 600, useNativeDriver: true }),
    ]).start();
  }, [play, a]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        alignSelf: 'center',
        top: sp.clear,
        opacity: a,
        transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [20, -10] }) }, { scale: a }],
      }}
    >
      <Text
        style={{
          backgroundColor: c.reward,
          color: c.onReward,
          fontSize: t.title,
          fontWeight: '800',
          paddingHorizontal: sp.l,
          paddingVertical: sp.s,
          borderRadius: r.pill,
          overflow: 'hidden',
        }}
      >
        {label}
      </Text>
    </Animated.View>
  );
}
