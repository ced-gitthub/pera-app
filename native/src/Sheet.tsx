import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Btn } from './Btn';
import { c, r, s, sp, t } from './ui';

// A bottom sheet that rises above the keyboard. Tapping outside or "Done" closes it.
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const { bottom } = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent statusBarTranslucent navigationBarTranslucent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: c.overlay }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={{
            backgroundColor: c.card,
            padding: sp.l,
            paddingBottom: bottom + sp.l,
            borderTopLeftRadius: r.l,
            borderTopRightRadius: r.l,
            maxHeight: '85%',
          }}
        >
          <Text style={s.h2}>{title}</Text>
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
          <Btn label="Done" alt onPress={onClose} />
        </View>
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
