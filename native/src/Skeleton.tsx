import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { c, e, r, s, sp } from './ui';

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

// The same layout as the live Home, shape for shape (header with avatar and Edit, total card, 2x2 tiles, level card, Recent rows), so nothing jumps when the real screen arrives.
export function HomeSkeleton() {
  return (
    <View style={[s.screen, { flex: 1 }]} accessibilityLabel="Loading your money">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: sp.m }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.m }}>
          <Skel w={e.s} h={e.s} round={r.pill} />
          <Skel w={140} h={sp.xl} />
        </View>
        <Skel w={72} h={e.s} round={r.m} />
      </View>
      <View style={{ marginBottom: sp.m }}>
        <Skel w="100%" h={e.l} round={r.l} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.s, marginBottom: sp.s }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ width: '48%', flexGrow: 1 }}>
            <Skel w="100%" h={e.m} round={r.s} />
          </View>
        ))}
      </View>
      {/* See all accounts link: same height as the live link (a line plus its vertical padding) */}
      <View style={{ alignItems: 'flex-end', paddingVertical: sp.xs, marginBottom: sp.m }}>
        <Skel w={120} h={sp.xl} />
      </View>
      <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: sp.m }]}>
        <Skel w={e.s} h={e.s} round={r.pill} />
        <View style={{ flex: 1, gap: sp.xs }}>
          <Skel w="60%" h={sp.l} />
          <Skel w="100%" h={sp.s} round={r.pill} />
          <Skel w="45%" h={sp.m} />
        </View>
        <Skel w={64} h={e.s} round={r.m} />
      </View>
      <Skel w={90} h={sp.xl} />
      {/* Tap an entry hint */}
      <View style={{ marginBottom: sp.s }}>
        <Skel w="70%" h={sp.l} />
      </View>
      {[0, 1, 2].map((i) => (
        <View key={i} style={s.row}>
          <View style={{ flex: 1, gap: sp.xs }}>
            <Skel w="55%" h={sp.l} />
            <Skel w="35%" h={sp.m} />
          </View>
          <Skel w={72} h={sp.l} />
        </View>
      ))}
    </View>
  );
}

// The same bar as the real tab bar (six tabs), so the bottom of the screen is already in place while the data loads.
export function TabBarSkeleton() {
  const { bottom } = useSafeAreaInsets();
  return (
    <View
      accessibilityElementsHidden
      style={{
        flexDirection: 'row',
        backgroundColor: c.card,
        borderTopWidth: 1,
        borderTopColor: c.line,
        paddingBottom: bottom + sp.s,
        paddingTop: sp.s,
      }}
    >
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: sp.s, gap: sp.xs }}>
          <Skel w={sp.xl} h={sp.xl} round={r.pill} />
          <Skel w={sp.xxl} h={sp.s} />
        </View>
      ))}
    </View>
  );
}

// Placeholders that look like the real lists. 'row' = plain rows (title and date left, amount right); 'card' = boxed cards like the live Activity and Planning lists;
// 'budget' = a card plus a progress bar line, like a budget.
export function ListSkeleton({ rows = 5, variant = 'row' }: { rows?: number; variant?: 'row' | 'card' | 'budget' }) {
  return (
    <View accessibilityLabel="Loading">
      {Array.from({ length: rows }, (_, i) =>
        variant === 'row' ? (
          <View key={i} style={s.row}>
            <View style={{ flex: 1, gap: sp.xs }}>
              <Skel w="55%" h={sp.l} />
              <Skel w="35%" h={sp.m} />
            </View>
            <Skel w={72} h={sp.l} />
          </View>
        ) : (
          <View key={i} style={[s.card, { marginBottom: sp.s }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, gap: sp.xs }}>
                <Skel w="55%" h={sp.l} />
                <Skel w="35%" h={sp.m} />
              </View>
              <Skel w={72} h={sp.l} />
            </View>
            {variant === 'budget' && (
              <View style={{ marginTop: sp.s }}>
                <Skel w="100%" h={sp.m} round={r.pill} />
              </View>
            )}
          </View>
        ),
      )}
    </View>
  );
}
