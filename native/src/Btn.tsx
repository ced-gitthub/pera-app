import { ActivityIndicator, Pressable, Text } from 'react-native';
import { c, s } from './ui';

// Disables itself while working so a double-tap cannot submit twice.
export function Btn({ label, onPress, busy, alt }: { label: string; onPress: () => void; busy?: boolean; alt?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy}
      onPress={onPress}
      style={[s.btn, alt && s.btnAlt, busy && { opacity: 0.6 }]}
    >
      {busy ? <ActivityIndicator color={alt ? c.ink : '#fff'} /> : <Text style={[s.btnText, alt && s.btnAltText]}>{label}</Text>}
    </Pressable>
  );
}
