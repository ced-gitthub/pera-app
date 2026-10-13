import { Pressable, Text } from 'react-native';
import { useCoachNode } from './Coach';
import { c, r, sp, t } from './ui';

// The one primary action of every tab: a lime pill floating at the bottom right. Place it inside the tab's flex:1
// container (which sits above the tab bar), so it never covers the tabs. Scrolling pages keep sp.clear of bottom padding.
export function Fab({ label, onPress }: { label: string; onPress: () => void }) {
  const coachRef = useCoachNode('fab');
  return (
    <Pressable
      ref={coachRef}
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={label.replace(/^＋\s*/, '')}
      onPress={onPress}
      style={({ pressed }) => ({
        position: 'absolute',
        right: sp.l,
        bottom: sp.l,
        backgroundColor: c.primary,
        borderRadius: r.pill,
        paddingVertical: sp.l,
        paddingHorizontal: sp.xl,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ color: c.onPrimary, fontSize: t.lead, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}
