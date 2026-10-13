import { ActivityIndicator, Pressable, Text } from 'react-native';
import { c, s } from './ui';

// Disables itself while working so a double-tap cannot submit twice. Pressing dims it, so the tap always feels registered.
export function Btn({
  label,
  onPress,
  busy,
  alt,
  danger,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  alt?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [s.btn, alt && s.btnAlt, danger && s.btnDanger, (busy || pressed) && { opacity: 0.7 }]}
    >
      {busy ? <ActivityIndicator color={alt ? c.ink : c.onPrimary} /> : <Text style={[s.btnText, alt && s.btnAltText]}>{label}</Text>}
    </Pressable>
  );
}
