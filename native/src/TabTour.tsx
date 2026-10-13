import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, BackHandler, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Btn } from './Btn';
import { useCoach } from './Coach';
import { nextIndex, padRect, placeTip, scrollDelta, sameRect, type Rect } from './coachLogic';
import { TOUR } from './tourContent';
import { c, r, sp, t } from './ui';

const MOVE_MS = 280;
const TIP_MS = 220;
const BOUNCE_MS = 520;
const TIP_W = 340;
const TIP_GUESS_H = 200;
const WAITS = [0, 120, 120, 200, 300, 500]; // after a tab switch the target may mount late; measure a few times until it stops moving
const pause = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
const fixed = (tgt: string) => tgt.startsWith('tab:') || tgt === 'fab'; // these sit on the screen already; never scroll for them

// The live coach-mark tour. It draws ON TOP of the real app (Gate has already switched to the step's tab): a dim layer with a hole around the real
// control, a tooltip with an arrow, and Back / Next / Skip. A full-screen touch blocker keeps everything underneath untappable.
export function TabTour({ index, onIndex, onClose }: { index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const api = useCoach();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const step = TOUR[Math.min(Math.max(index, 0), TOUR.length - 1)];
  const root = useRef<View>(null);
  const [still, setStill] = useState(false);
  const [hole, setHole] = useState<Rect | null>(null);
  const [empty, setEmpty] = useState(false);
  const [tipH, setTipH] = useState(TIP_GUESS_H);
  const [tick, setTick] = useState(0);
  const ax = useRef(new Animated.Value(width / 2)).current;
  const ay = useRef(new Animated.Value(height / 2)).current;
  const aw = useRef(new Animated.Value(0)).current;
  const ah = useRef(new Animated.Value(0)).current;
  const tipIn = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  const first = useRef(true);

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((v) => live && setStill(!!v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setStill(!!v));
    return () => {
      live = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  // Re-measure when a target mounts or lays out late (a list that finishes loading). Debounced so a burst is one pass.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = api.subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(() => setTick((n) => n + 1), 150);
    });
    return () => {
      clearTimeout(timer);
      off();
    };
  }, [api]);

  // The tooltip leaves while we look for the new target...
  useEffect(() => {
    tipIn.setValue(still ? 1 : 0);
  }, [index, still, tipIn]);

  // ...find the real control, scroll it into view if needed, wait until it stops moving, then move the spotlight there.
  useEffect(() => {
    let live = true;
    const id = step.targetId;
    const origin = () =>
      new Promise<{ x: number; y: number }>((res) => {
        const n = root.current;
        if (!n) return res({ x: 0, y: 0 });
        n.measureInWindow((x, y) => res({ x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 }));
      });
    const commit = (r: Rect | null) => {
      if (!live) return;
      const h = r ? padRect(r, sp.s, { w: width, h: height }) : null;
      setHole(h);
      setEmpty(!r || api.isEmpty(id));
      const to = h ?? { x: width / 2, y: height / 2, w: 0, h: 0 };
      const jump = still || first.current;
      first.current = false;
      if (jump) {
        ax.setValue(to.x);
        ay.setValue(to.y);
        aw.setValue(to.w);
        ah.setValue(to.h);
      } else {
        Animated.parallel(
          [ax, ay, aw, ah].map((v, k) =>
            Animated.timing(v, { toValue: [to.x, to.y, to.w, to.h][k], duration: MOVE_MS, useNativeDriver: false }),
          ),
        ).start();
      }
      if (still) tipIn.setValue(1);
      else Animated.timing(tipIn, { toValue: 1, duration: TIP_MS, useNativeDriver: true }).start();
    };
    void (async () => {
      let prev: Rect | null = null;
      let scrolls = 0;
      for (const w of WAITS) {
        await pause(w);
        if (!live) return;
        const [o, raw, bar] = await Promise.all([origin(), api.measure(id), fixed(id) ? Promise.resolve(null) : api.measure('tab:home')]);
        if (!live) return;
        if (!raw) {
          prev = null;
          continue;
        }
        const rect = { x: raw.x - o.x, y: raw.y - o.y, w: raw.w, h: raw.h };
        if (!fixed(id) && scrolls < 3) {
          const band = { top: insets.top, bottom: bar ? bar.y - o.y : height - insets.bottom - sp.clear };
          const dy = scrollDelta(rect, band, sp.l);
          if (dy !== 0) {
            scrolls += 1;
            api.scrollBy(dy);
            prev = null;
            continue;
          }
        }
        if (sameRect(prev, rect)) return commit(rect);
        prev = rect;
      }
      commit(prev);
    })();
    return () => {
      live = false;
    };
  }, [index, tick, width, height, still, step.targetId, api, insets.top, insets.bottom, ax, ay, aw, ah, tipIn]);

  useEffect(() => {
    if (still || !hole) {
      bounce.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: BOUNCE_MS, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: BOUNCE_MS, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [still, hole, bounce]);

  const last = index >= TOUR.length - 1;
  const tipW = Math.min(TIP_W, width - sp.l * 2);
  const place = placeTip(
    hole,
    { w: width, h: height },
    { w: tipW, h: tipH },
    { top: insets.top + sp.s, bottom: insets.bottom + sp.s },
    sp.l,
    sp.l,
  );
  const dir = place.side === 'below' ? -1 : 1; // the arrow bounces toward the control
  const arrowShift = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, dir * sp.xs] });
  const slide = tipIn.interpolate({ inputRange: [0, 1], outputRange: [place.side === 'above' ? -sp.m : sp.m, 0] });
  const body = empty && step.emptyText ? step.emptyText : step.text;
  const go = (d: 1 | -1) => {
    const n = nextIndex(index, TOUR.length, d);
    if (n.done) onClose();
    else onIndex(n.index);
  };
  const dim = { position: 'absolute', backgroundColor: c.overlay } as const;
  const arrowBase = {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: sp.m,
    borderRightWidth: sp.m,
    borderColor: 'transparent',
  } as const;

  return (
    <View
      ref={root}
      collapsable={false}
      style={StyleSheet.absoluteFill}
      onStartShouldSetResponder={() => true}
      accessibilityViewIsModal
      testID="coach-overlay"
    >
      <Animated.View pointerEvents="none" style={[dim, { left: 0, right: 0, top: 0, height: ay }]} />
      <Animated.View pointerEvents="none" style={[dim, { left: 0, right: 0, bottom: 0, top: Animated.add(ay, ah) }]} />
      <Animated.View pointerEvents="none" style={[dim, { left: 0, top: ay, height: ah, width: ax }]} />
      <Animated.View pointerEvents="none" style={[dim, { right: 0, top: ay, height: ah, left: Animated.add(ax, aw) }]} />
      {hole && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: ax,
            top: ay,
            width: aw,
            height: ah,
            borderRadius: r.s,
            borderWidth: 2,
            borderColor: c.primary,
            opacity: tipIn,
          }}
        />
      )}
      <Animated.View
        onLayout={(ev) => setTipH(ev.nativeEvent.layout.height)}
        accessibilityLiveRegion="polite"
        style={{
          position: 'absolute',
          top: place.top,
          left: place.left,
          width: tipW,
          opacity: tipIn,
          transform: [{ translateY: slide }],
          backgroundColor: c.card,
          borderRadius: r.m,
          borderWidth: 1,
          borderColor: c.line,
          padding: sp.l,
        }}
      >
        {place.side !== 'center' && (
          <Animated.View
            pointerEvents="none"
            style={[
              arrowBase,
              { left: place.arrowX - sp.m, transform: [{ translateY: arrowShift }] },
              place.side === 'below'
                ? { top: -sp.m, borderBottomWidth: sp.m, borderBottomColor: c.card }
                : { bottom: -sp.m, borderTopWidth: sp.m, borderTopColor: c.card },
            ]}
          />
        )}
        <Text style={{ color: c.mute, fontSize: t.caption }}>{`${index + 1} of ${TOUR.length}`}</Text>
        <Text style={{ color: c.ink, fontSize: t.title, fontWeight: '800', marginTop: sp.xs }}>{step.title}</Text>
        <Text style={{ color: c.ink, fontSize: t.body, marginTop: sp.s, marginBottom: sp.l }}>{body}</Text>
        <View style={{ flexDirection: 'row' }}>
          {index > 0 && (
            <View style={{ flex: 1, marginRight: sp.s }}>
              <Btn label="Back" alt onPress={() => go(-1)} />
            </View>
          )}
          <View style={{ flex: 2 }}>
            <Btn label={last ? 'Got it' : 'Next'} onPress={() => go(1)} />
          </View>
        </View>
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
      </Animated.View>
    </View>
  );
}
