import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Btn } from './Btn';
import { TOUR, type TourSlide } from './tourContent';
import { c, e, r, s, sp, t } from './ui';

const SLIDE_MS = 320;
const BOUNCE_MS = 700;

// One slide. When it becomes the active one, the text slides in and the emoji bounces (still, if the phone asks for reduced motion).
function Slide({ slide, width, active, still }: { slide: TourSlide; width: number; active: boolean; still: boolean }) {
  const enter = useRef(new Animated.Value(still ? 1 : 0)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) {
      enter.setValue(1);
      bounce.setValue(0);
      return;
    }
    if (!active) {
      enter.setValue(0);
      return;
    }
    Animated.timing(enter, { toValue: 1, duration: SLIDE_MS, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: BOUNCE_MS, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: BOUNCE_MS, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, still, enter, bounce]);
  const slideIn = enter.interpolate({ inputRange: [0, 1], outputRange: [48, 0] });
  const lift = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -sp.m] });
  return (
    <View
      style={{ width, paddingHorizontal: sp.xl, justifyContent: 'center' }}
      accessible
      accessibilityLabel={`${slide.title}. ${slide.text} Example: ${slide.example}`}
    >
      <Animated.View style={{ opacity: enter, transform: [{ translateX: slideIn }] }}>
        <Animated.Text style={{ fontSize: e.l, textAlign: 'center', transform: [{ translateY: lift }] }}>{slide.emoji}</Animated.Text>
        <Text style={[s.h1, { textAlign: 'center', marginTop: sp.l }]}>{slide.title}</Text>
        <Text style={{ color: c.ink, fontSize: t.lead, textAlign: 'center', marginTop: sp.m }}>{slide.text}</Text>
        <View style={{ backgroundColor: c.card, borderRadius: r.m, padding: sp.l, marginTop: sp.xl, borderWidth: 1, borderColor: c.line }}>
          <Text style={{ color: c.reward, fontSize: t.caption, fontWeight: '700' }}>EXAMPLE</Text>
          <Text style={{ color: c.mute, fontSize: t.body, marginTop: sp.xs }}>{slide.example}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

// A full-screen tour of the bottom tabs. Swipe, or use Back / Next at the bottom (reachable with one thumb). Skip is always visible until the last slide.
export function TabTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();
  const [i, setI] = useState(0);
  const [still, setStill] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const last = i === TOUR.length - 1;

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((v) => live && setStill(!!v));
    return () => {
      live = false;
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setI(0);
      scroller.current?.scrollTo({ x: 0, animated: false });
    }
  }, [open]);

  const go = (n: number) => {
    const k = Math.max(0, Math.min(TOUR.length - 1, n));
    setI(k);
    scroller.current?.scrollTo({ x: k * width, animated: !still });
  };
  const onEnd = (ev: NativeSyntheticEvent<NativeScrollEvent>) => setI(Math.round(ev.nativeEvent.contentOffset.x / width));

  return (
    <Modal visible={open} animationType={still ? 'none' : 'fade'} statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: top + sp.m, paddingBottom: bottom + sp.l }}>
        <Text accessibilityLiveRegion="polite" style={{ color: c.mute, fontSize: t.caption, textAlign: 'center' }}>
          {`${i + 1} of ${TOUR.length}`}
        </Text>
        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onEnd}
          style={{ flex: 1 }}
          contentContainerStyle={{ alignItems: 'center' }}
        >
          {TOUR.map((x, k) => (
            <Slide key={x.id} slide={x} width={width} active={open && k === i} still={still} />
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: sp.l }}>
          {TOUR.map((x, k) => (
            <View
              key={x.id}
              style={{
                width: k === i ? 24 : 8,
                height: 8,
                borderRadius: r.pill,
                marginHorizontal: sp.xs,
                backgroundColor: k === i ? c.primary : c.dim,
              }}
            />
          ))}
        </View>
        <View style={{ paddingHorizontal: sp.l }}>
          {last ? (
            <Btn label="Got it" onPress={onClose} />
          ) : (
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, marginRight: sp.s }}>{i > 0 ? <Btn label="Back" alt onPress={() => go(i - 1)} /> : null}</View>
              <View style={{ flex: 2 }}>
                <Btn label="Next" onPress={() => go(i + 1)} />
              </View>
            </View>
          )}
          {!last && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip the tour"
              onPress={onClose}
              style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: c.mute, fontSize: t.body, fontWeight: '600' }}>Skip</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}
