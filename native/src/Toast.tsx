import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { c, r, sp, t } from './ui';

// The pop-out confirmation: a centred card with a check, so a person can be sure something was saved. Used by the Sheet and, app-wide, through useToast().
export function ToastCard({ message, pop }: { message: string; pop: Animated.Value }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      <Animated.View
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        style={{
          backgroundColor: c.card,
          borderColor: c.up,
          borderWidth: 2,
          borderRadius: r.l,
          paddingVertical: sp.l,
          paddingHorizontal: sp.xl,
          alignItems: 'center',
          opacity: pop,
          transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
        }}
      >
        <Text style={{ color: c.up, fontSize: t.head, fontWeight: '800' }}>✓</Text>
        <Text style={{ color: c.ink, fontSize: t.title, fontWeight: '800', marginTop: sp.xs }}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const TOAST_MS = 2200;
const Ctx = createContext<(message: string) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const pop = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback(
    (message: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMsg(message);
      pop.setValue(0);
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 6 }).start();
      timer.current = setTimeout(() => setMsg(null), TOAST_MS);
    },
    [pop],
  );
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {!!msg && <ToastCard message={msg} pop={pop} />}
    </Ctx.Provider>
  );
}
