import { useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Animated, FlatList, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Btn } from './Btn';
import { c, s } from './ui';

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
    bg: '#7A4DF0',
    title: 'Log it in one line',
    text: 'Just type what happened. Zovix works out the rest.',
    demo: ['lunch 150 gcash', 'Food · GCash · -₱150.00'],
  },
  {
    emoji: '🎯',
    bg: '#3D2AB5',
    title: 'Budgets that warn you',
    text: 'Set a limit for Food, Transport, anything. The bar turns red before you overspend.',
    demo: ['Food · ₱3,000 a month', '₱1,200 spent · ₱1,800 left'],
  },
  {
    emoji: '🏆',
    bg: '#E0A800',
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
          <View style={{ width, paddingHorizontal: 28, paddingTop: top + 60, alignItems: 'center' }}>
            <Animated.Text style={{ fontSize: 84, transform: [{ scale: pop }] }}>{item.emoji}</Animated.Text>
            <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800', textAlign: 'center', marginTop: 18 }}>{item.title}</Text>
            <Text style={{ color: '#fff', opacity: 0.9, fontSize: 17, textAlign: 'center', marginTop: 12, lineHeight: 24 }}>
              {item.text}
            </Text>
            {item.demo && (
              <View style={{ marginTop: 28, backgroundColor: '#fff', borderRadius: 18, padding: 18, width: '100%' }}>
                <Text style={[s.p, { fontSize: 13 }]}>You type</Text>
                <Text style={{ color: c.ink, fontSize: 20, fontWeight: '800', marginBottom: 10 }}>{item.demo[0]}</Text>
                <Text style={[s.p, { fontSize: 13 }]}>Zovix does</Text>
                <Text style={{ color: c.green, fontSize: 17, fontWeight: '700' }}>{item.demo[1]}</Text>
              </View>
            )}
          </View>
        )}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 18 }}>
        {SLIDES.map((x, k) => (
          <View
            key={x.title}
            style={{ width: k === i ? 26 : 8, height: 8, borderRadius: 4, backgroundColor: k === i ? c.yellow : '#ffffff77' }}
          />
        ))}
      </View>
      <View style={{ paddingHorizontal: 20, paddingBottom: bottom + 24 }}>
        <Btn label="Create my account" alt onPress={() => onDone('signup')} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="I already have an account"
          onPress={() => onDone('login')}
          style={{ padding: 12 }}
        >
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700', fontSize: 16 }}>I already have an account</Text>
        </Pressable>
      </View>
    </View>
  );
}
