import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { c, r, s, sp } from './ui';

// Grey shapes that pulse where the real content will appear, so waiting never looks like an error.
export function Skel({ w, h, round = r.s }: { w: number | `${number}%`; h: number; round?: number }) {
  const o = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 0.8, duration: 700, useNativeDriver: true }),
        Animated.timing(o, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [o]);
  return (
    <Animated.View
      accessibilityElementsHidden
      style={{ width: w, height: h, borderRadius: round, backgroundColor: c.raised, opacity: o }}
    />
  );
}

export function HomeSkeleton() {
  return (
    <View style={s.screen} accessibilityLabel="Loading your money">
      <Skel w="45%" h={28} />
      <View style={{ height: sp.l }} />
      <Skel w="100%" h={150} round={r.m} />
      <View style={{ height: sp.l, flexDirection: 'row', gap: sp.m, marginTop: sp.l }}>
        <Skel w={150} h={96} round={r.m} />
        <Skel w={150} h={96} round={r.m} />
      </View>
      <View style={{ height: sp.xxl }} />
      <Skel w="100%" h={56} round={r.m} />
      <View style={{ height: sp.m }} />
      <Skel w="100%" h={56} round={r.m} />
      <View style={{ height: sp.m }} />
      <Skel w="100%" h={56} round={r.m} />
    </View>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <View accessibilityLabel="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ marginBottom: sp.m }}>
          <Skel w="100%" h={64} round={r.m} />
        </View>
      ))}
    </View>
  );
}
