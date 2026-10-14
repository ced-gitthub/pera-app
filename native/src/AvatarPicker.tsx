import { Pressable, Text, View } from 'react-native';
import { c, r, s, sp, t, e } from './ui';
import { AVATAR_COLORS } from './themes';
import { AVATARS, AVATAR_COLOR_IDS, FRAMES, FRAME_LABEL, type Profile } from './profileLogic';
import { Avatar } from './Avatar';

// Pick an avatar emoji, a background colour and a frame. `value` is the current choice; onChange gets the whole new profile (status untouched).
export function AvatarPicker({ value, name, onChange }: { value: Profile; name: string; onChange: (p: Profile) => void }) {
  return (
    <View>
      <View style={{ alignItems: 'center', marginVertical: sp.m }}>
        <Avatar size={e.l} name={name} meta={value} />
      </View>
      <Text style={[s.p, { marginBottom: sp.xs }]}>Avatar</Text>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.s, marginBottom: sp.m }}>
        {AVATARS.map((a) => (
          <Pressable
            key={a}
            hitSlop={sp.xs}
            accessibilityRole="radio"
            accessibilityLabel={`Avatar ${a}`}
            accessibilityState={{ selected: a === value.avatar }}
            onPress={() => onChange({ ...value, avatar: a })}
            style={{
              width: e.s,
              height: e.s,
              borderRadius: r.s,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: c.raised,
              borderWidth: a === value.avatar ? 3 : 1,
              borderColor: a === value.avatar ? c.primary : c.line,
            }}
          >
            <Text allowFontScaling={false} style={{ fontSize: t.title }}>
              {a}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={[s.p, { marginBottom: sp.xs }]}>Colour</Text>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.s, marginBottom: sp.m }}>
        {AVATAR_COLOR_IDS.map((id) => (
          <Pressable
            key={id}
            hitSlop={sp.xs}
            accessibilityRole="radio"
            accessibilityLabel={`Colour ${id}`}
            accessibilityState={{ selected: id === value.avatarColor }}
            onPress={() => onChange({ ...value, avatarColor: id })}
            style={{
              width: e.s,
              height: e.s,
              borderRadius: r.pill,
              backgroundColor: AVATAR_COLORS[id],
              borderWidth: id === value.avatarColor ? 3 : 1,
              borderColor: id === value.avatarColor ? c.ink : c.line,
            }}
          />
        ))}
      </View>
      <Text style={[s.p, { marginBottom: sp.xs }]}>Frame</Text>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: sp.s, marginBottom: sp.m }}>
        {FRAMES.map((f) => (
          <Pressable
            key={f}
            accessibilityRole="radio"
            accessibilityLabel={`Frame ${FRAME_LABEL[f]}`}
            accessibilityState={{ selected: f === value.frame }}
            onPress={() => onChange({ ...value, frame: f })}
            style={[s.chip, f === value.frame && { borderColor: c.primary, borderWidth: 2 }]}
          >
            <Text style={{ color: f === value.frame ? c.primary : c.ink, fontSize: t.body, fontWeight: '700' }}>{FRAME_LABEL[f]}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
