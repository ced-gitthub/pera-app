import { Text, View } from 'react-native';
import { c } from './ui';
import { AVATAR_COLORS } from './themes';
import { avatarLabel, defaultAvatar, profileFromMeta, type ProfileMeta } from './profileLogic';

// The person's avatar: an emoji on a coloured disc, with an optional frame (ring or glow). Without saved choices it shows their default,
// which is worked out from their name (or email), so everybody has one straight away.
export function Avatar({
  size,
  name = '',
  email = '',
  meta,
  label,
}: {
  size: number;
  name?: string;
  email?: string;
  meta?: ProfileMeta;
  label?: string;
}) {
  const p = meta ? profileFromMeta(meta, name, email) : { ...defaultAvatar(name, email), frame: 'none' as const };
  const ring = p.frame === 'ring';
  const glow = p.frame === 'glow';
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label ?? avatarLabel(name)}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: AVATAR_COLORS[p.avatarColor],
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: ring ? Math.max(2, Math.round(size / 16)) : 0,
        borderColor: c.primary,
        shadowColor: c.primary,
        shadowOpacity: glow ? 0.9 : 0,
        shadowRadius: glow ? size / 4 : 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: glow ? 8 : 0,
      }}
    >
      <Text allowFontScaling={false} style={{ fontSize: Math.round(size * 0.52), textAlign: 'center' }}>
        {p.avatar}
      </Text>
    </View>
  );
}
