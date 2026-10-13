import { useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Animated, FlatList, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Btn } from './Btn';
import { c, s, sp, t, e, r } from './ui';

// First thing a new visitor sees: four swipeable slides with a worked example each, then "Create my account" / "I already have one".
const SLIDES = [
  {
    emoji: '👋',
    bg: c.purple,
    title: 'Welcome to Zovix',
    text: 'The peso tracker that feels like a game. Know where every peso goes, in seconds.',
    demo: null,
  },
  {
    emoji: '🪙',
    bg: c.hero.violet,
    title: 'Log it in one line',
    text: 'Just type what happened. Zovix works out the rest.',
    demo: ['lunch 150 gcash', 'Food · GCash · -₱150.00'],
  },
  {
    emoji: '🎯',
    bg: c.hero.indigo,
    title: 'Budgets that warn you',
    text: 'Set a limit for Food, Transport, anything. The bar turns red before you overspend.',
    demo: ['Food · ₱3,000 a month', '₱1,200 spent · ₱1,800 left'],
  },
  {
    emoji: '🏆',
    bg: c.hero.gold,
    title: 'Save for what you want',
    text: 'Start a goal, watch it fill up, earn levels and streaks along the way.',
    demo: ['New phone · ₱15,000', '₱6,000 saved · 40% 🎉'],
  },
];

export function Welcome({ onDone }: { onDone: (mode: 'signup' | 'login') => void }) {
  const { width } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();
  const [i, setI] = useState(0);
  const pop = useRef(new Animated.Value(1)).current;
  const bounce = () => {
    pop.setValue(0.9);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 4 }).start();
  };
  return (
    <View style={{ flex: 1, backgroundColor: SLIDES[i].bg }}>
      <FlatList
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(x) => x.title}
        onMomentumScrollEnd={(e) => {
          setI(Math.round(e.nativeEvent.contentOffset.x / width));
          bounce();
        }}
        renderItem={({ item }) => (
          <View style={{ width, paddingHorizontal: sp.xl, paddingTop: top + sp.xxl, alignItems: 'center' }}>
            <Animated.Text style={{ fontSize: e.l, transform: [{ scale: pop }] }}>{item.emoji}</Animated.Text>
            <Text style={{ color: c.white, fontSize: t.head, fontWeight: '800', textAlign: 'center', marginTop: sp.l }}>{item.title}</Text>
            <Text style={{ color: c.white, opacity: 0.9, fontSize: t.lead, textAlign: 'center', marginTop: sp.m, lineHeight: 24 }}>
              {item.text}
            </Text>
            {item.demo && (
              <View style={{ marginTop: sp.xl, backgroundColor: c.white, borderRadius: r.m, padding: sp.l, width: '100%' }}>
                <Text style={[s.p, { fontSize: t.caption }]}>You type</Text>
                <Text style={{ color: c.ink, fontSize: t.lead, fontWeight: '800', marginBottom: sp.s }}>{item.demo[0]}</Text>
                <Text style={[s.p, { fontSize: t.caption }]}>Zovix does</Text>
                <Text style={{ color: c.green, fontSize: t.lead, fontWeight: '700' }}>{item.demo[1]}</Text>
              </View>
            )}
          </View>
        )}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: sp.s, marginBottom: sp.l }}>
        {SLIDES.map((x, k) => (
          <View
            key={x.title}
            style={{ width: k === i ? 26 : 8, height: 8, borderRadius: r.pill, backgroundColor: k === i ? c.yellow : c.dim }}
          />
        ))}
      </View>
      <View style={{ paddingHorizontal: sp.xl, paddingBottom: bottom + sp.xl }}>
        <Btn label="Create my account" alt onPress={() => onDone('signup')} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="I already have an account"
          onPress={() => onDone('login')}
          style={{ padding: sp.m }}
        >
          <Text style={{ color: c.white, textAlign: 'center', fontWeight: '700', fontSize: t.body }}>I already have an account</Text>
        </Pressable>
      </View>
    </View>
  );
}
