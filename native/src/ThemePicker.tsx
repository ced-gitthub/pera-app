import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, Text, View } from 'react-native';
import { c, r, sp, t } from './ui';
import { THEME_LIST } from './themes';
import type { ThemeDef, ThemeId } from './themeLogic';

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => live && setReduce(v))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return reduce;
}

// One theme as a little preview card painted in that theme's own colours (never the current theme's), so what you see is what you get.
function Swatch({
  theme,
  picked,
  reduce,
  disabled,
  onPick,
}: {
  theme: ThemeDef;
  picked: boolean;
  reduce: boolean;
  disabled?: boolean;
  onPick: () => void;
}) {
  const k = theme.colors;
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduce) {
      scale.setValue(1);
      return;
    }
    Animated.spring(scale, { toValue: picked ? 1.04 : 1, friction: 4, tension: 160, useNativeDriver: true }).start();
  }, [picked, reduce, scale]);
  return (
    <Animated.View style={{ width: '48%', transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: picked, disabled: !!disabled }}
        accessibilityLabel={`${theme.name} theme. ${theme.blurb}`}
        disabled={disabled}
        onPress={onPick}
        style={({ pressed }) => ({
          backgroundColor: k.bg,
          borderRadius: r.m,
          padding: sp.m,
          borderWidth: picked ? 3 : 1,
          borderColor: picked ? k.primary : k.line,
          opacity: pressed ? 0.8 : 1,
          minHeight: 88,
        })}
      >
        <View style={{ flexDirection: 'row', gap: sp.xs, marginBottom: sp.s }}>
          {[k.primary, k.up, k.down, k.reward].map((col, i) => (
            <View key={i} style={{ width: sp.l, height: sp.l, borderRadius: r.pill, backgroundColor: col }} />
          ))}
        </View>
        <View style={{ backgroundColor: k.card, borderRadius: r.s, padding: sp.s }}>
          <Text numberOfLines={1} style={{ color: k.ink, fontSize: t.body, fontWeight: '800' }}>
            {theme.name}
          </Text>
          <Text numberOfLines={1} style={{ color: k.mute, fontSize: t.caption }}>
            {theme.blurb}
          </Text>
        </View>
        {picked && (
          <View
            style={{
              position: 'absolute',
              top: sp.s,
              right: sp.s,
              width: sp.xl,
              height: sp.xl,
              borderRadius: r.pill,
              backgroundColor: k.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: k.onPrimary, fontSize: t.caption, fontWeight: '800' }}>✓</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// The grid of all themes. Tapping one calls onPick right away (the caller applies it).
export function ThemePicker({ value, onPick, disabled }: { value: ThemeId; onPick: (id: ThemeId) => void; disabled?: boolean }) {
  const reduce = useReduceMotion();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.s, justifyContent: 'space-between' }}>
      {THEME_LIST.map((th) => (
        <Swatch key={th.id} theme={th} picked={th.id === value} reduce={reduce} disabled={disabled} onPick={() => onPick(th.id)} />
      ))}
    </View>
  );
}

// "Applied" confirmation line in the current theme's success colour.
export const appliedStyle = () => ({ color: c.up, fontSize: t.body, marginVertical: sp.s, fontWeight: '700' as const });
