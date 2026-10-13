import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { c, e, r, s, sp, t, themeState } from './ui';
import { Btn } from './Btn';
import { APP_ICON_NAMES, iconForTheme, type AppIconName } from './appIcon';
import { APP_ICON_PREVIEWS } from './appIconAssets';
import { canChangeAppIcon, currentAppIcon, setAppIcon } from './appIconApi';

// "App icon" under Theme: pick the launcher icon colour. Only shown where the phone can do it (the Android app).
export function AppIconSection() {
  const [picked, setPicked] = useState<AppIconName | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const lock = useRef(false);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    currentAppIcon().then((n) => live.current && setPicked(n));
    return () => {
      live.current = false;
    };
  }, []);
  if (!canChangeAppIcon) return null;
  const choose = async (name: AppIconName) => {
    if (lock.current) return;
    if (name === picked) return setMsg(`Icon is already ${name}`);
    lock.current = true;
    setBusy(true);
    setErr('');
    setMsg('');
    const problem = await setAppIcon(name);
    lock.current = false;
    if (!live.current) return;
    setBusy(false);
    if (problem) return setErr(problem);
    setPicked(name);
    setMsg(`Icon set to ${name}`);
  };
  return (
    <View style={{ marginTop: sp.xl }}>
      <Text style={s.h2}>App icon</Text>
      <Text style={[s.p, { marginBottom: sp.m }]}>Pick the colour of the Zovix icon on your phone.</Text>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.m, marginBottom: sp.m }}>
        {APP_ICON_NAMES.map((name) => {
          const on = name === picked;
          return (
            <Pressable
              key={name}
              accessibilityRole="radio"
              accessibilityState={{ selected: on, disabled: busy }}
              accessibilityLabel={`${name} app icon${on ? ', selected' : ''}`}
              disabled={busy}
              onPress={() => choose(name)}
              style={({ pressed }) => ({ alignItems: 'center', opacity: busy || pressed ? 0.6 : 1 })}
            >
              <Image
                source={APP_ICON_PREVIEWS[name]}
                accessibilityIgnoresInvertColors
                style={{
                  width: e.l,
                  height: e.l,
                  borderRadius: r.pill,
                  borderWidth: on ? 3 : 1,
                  borderColor: on ? c.primary : c.line,
                }}
              />
              <Text style={{ color: on ? c.primary : c.mute, fontSize: t.caption, fontWeight: '800', marginTop: sp.xs }}>
                {on ? '✓ ' : ''}
                {name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Btn label="Match my theme" alt busy={busy} onPress={() => choose(iconForTheme(themeState.id))} />
      <Text style={[s.p, { marginTop: sp.s }]}>The launcher may take a few seconds to update, and your home screen may flicker once.</Text>
      {!!msg && (
        <Text accessibilityLiveRegion="polite" style={s.ok}>
          {msg}
        </Text>
      )}
      {!!err && (
        <Text accessibilityRole="alert" style={s.err}>
          {err}
        </Text>
      )}
    </View>
  );
}
