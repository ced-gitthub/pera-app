import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { c, r, s, sp, t } from './ui';

// The pinned close button of a sheet or full-screen page: always in the header, never scrolled away, at least 48 tall.
export function HeaderClose({ label = 'Done', onPress }: { label?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={sp.s}
      style={({ pressed }) => [
        s.chip,
        { minHeight: 48, minWidth: 72, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={{ color: c.primary, fontSize: t.body, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}

// A bottom sheet that rises above the keyboard. The title and a "Done" button sit in a header that is always visible;
// only the content scrolls (it shrinks to fit), so Done is never pushed off-screen. Tapping outside also closes it.
export function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
  toast,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode; // pinned below the scrolling content: always on screen
  toast?: string | null; // a centred card that pops out over the sheet (for example 'Profile saved')
}) {
  const { bottom } = useSafeAreaInsets();
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!toast) return;
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 6 }).start();
  }, [toast, pop]);
  return (
    <Modal visible={open} transparent statusBarTranslucent navigationBarTranslucent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: c.overlay }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={{
            backgroundColor: c.card,
            paddingHorizontal: sp.l,
            paddingTop: sp.m,
            // inside a Modal the inset can read 0 on Android, so keep a floor clear of the system navigation bar
            paddingBottom: Math.max(bottom, sp.xl),
            borderTopLeftRadius: r.l,
            borderTopRightRadius: r.l,
            maxHeight: '85%',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: sp.s }}>
            <Text style={[s.h2, { flex: 1, marginBottom: 0 }]} accessibilityRole="header" numberOfLines={2}>
              {title}
            </Text>
            <HeaderClose onPress={onClose} />
          </View>
          <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {!!footer && <View style={{ paddingTop: sp.m }}>{footer}</View>}
        </View>
        {!!toast && (
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
              <Text style={{ color: c.ink, fontSize: t.title, fontWeight: '800', marginTop: sp.xs }}>{toast}</Text>
            </Animated.View>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// A row with a label and an on/off pill, used by the settings sheets.
export function ToggleRow({
  label,
  hint,
  on,
  onChange,
  busy,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onChange: (v: boolean) => void;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on, busy }}
      disabled={busy}
      onPress={() => onChange(!on)}
      style={[s.row, { alignItems: 'center', opacity: busy ? 0.5 : 1 }]}
    >
      <View style={{ flex: 1, paddingRight: sp.m }}>
        <Text style={{ color: c.ink, fontSize: t.body, fontWeight: '600' }}>{label}</Text>
        {!!hint && <Text style={s.p}>{hint}</Text>}
      </View>
      <View
        style={{
          width: 52,
          height: 30,
          borderRadius: r.pill,
          backgroundColor: on ? c.primary : c.raised,
          justifyContent: 'center',
          padding: sp.xs,
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: r.pill,
            backgroundColor: on ? c.onPrimary : c.mute,
            alignSelf: on ? 'flex-end' : 'flex-start',
          }}
        />
      </View>
    </Pressable>
  );
}
