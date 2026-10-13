import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { c, e, s, sp, t, themeState } from './ui';
import { THEMES } from './themes';
import { Avatar } from './Avatar';
import { useProfile } from './profile';

// A tappable card for Settings: shows who you are (avatar, name, status) and your theme, and opens the Personalize sheet.
// Change `version` (any new number) after the sheet closes to reload the avatar and name.
export function PersonalizeCard({ onOpen, version = 0 }: { onOpen: () => void; version?: number }) {
  const { state, reload } = useProfile();
  useEffect(() => {
    if (version) reload();
  }, [version, reload]);
  const name = state?.name ?? '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Make it yours: change your theme and profile"
      onPress={onOpen}
      style={({ pressed }) => [s.card, { flexDirection: 'row', alignItems: 'center', minHeight: 64, opacity: pressed ? 0.8 : 1 }]}
    >
      <Avatar size={e.m} name={name} email={state?.email} meta={state?.profile} />
      <View style={{ flex: 1, marginLeft: sp.m }}>
        <Text numberOfLines={1} style={{ color: c.ink, fontSize: t.lead, fontWeight: '800' }}>
          {name || 'Make it yours'}
        </Text>
        {!!state?.profile.status && (
          <Text numberOfLines={1} style={s.p}>
            {state.profile.status}
          </Text>
        )}
        <Text numberOfLines={1} style={{ color: c.primary, fontSize: t.caption, fontWeight: '700' }}>
          {THEMES[themeState.id].name} theme · Change theme and profile
        </Text>
      </View>
      <Text style={{ color: c.mute, fontSize: t.lead }}>›</Text>
    </Pressable>
  );
}
