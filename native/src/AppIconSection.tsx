import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import { c, e, r, s, sp, t, themeState } from './ui';
import { Btn } from './Btn';
import { APP_ICON_NAMES, ICON_APPLY_NOW_WARNING, ICON_PENDING_TEXT, DEFAULT_APP_ICON, iconForTheme, highlightedIcon, matchIconLabel, type AppIconName } from './appIcon';
import { APP_ICON_PREVIEWS } from './appIconAssets';
import { applyPendingAppIcon, canChangeAppIcon, currentAppIcon, pendingAppIcon, queueAppIcon } from './appIconApi';

// "App icon" under Theme: pick the launcher icon colour. Only shown where the phone can do it (the Android app).
export function AppIconSection() {
  const [current, setCurrent] = useState<AppIconName | null>(null);
  const [pending, setPending] = useState<AppIconName | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    Promise.all([currentAppIcon(), pendingAppIcon()]).then(([c0, p0]) => {
      if (!live.current) return;
      setCurrent(c0);
      setPending(p0 && p0 !== c0 ? p0 : null); // a queued choice equal to the icon in use is not pending
    });
    return () => {
      live.current = false;
    };
  }, []);
  if (!canChangeAppIcon) return null;
  const picked = highlightedIcon(current, pending);
  const inUse = current ?? DEFAULT_APP_ICON; // the original launcher icon is the default one
  // Picking only QUEUES the icon: nothing closes now. It changes when the person leaves the app (Gate applies it), or on "Apply now".
  const choose = async (name: AppIconName) => {
    setErr('');
    if (name === inUse && !pending) return setMsg(`Icon is already ${name}`);
    const problem = await queueAppIcon(name);
    if (!live.current) return;
    if (problem) return setErr(problem);
    setPending(name === inUse ? null : name);
    setMsg(name === inUse ? `Icon stays ${name}` : ICON_PENDING_TEXT(name));
  };
  const applyNow = () =>
    Alert.alert('Change the icon now?', ICON_APPLY_NOW_WARNING, [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Apply and close',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          const problem = await applyPendingAppIcon();
          if (live.current) {
            setBusy(false);
            if (problem) setErr(problem);
          }
        },
      },
    ]);
  return (
    <View style={{ marginTop: sp.xl }}>
      <Text style={s.h2}>App icon</Text>
      <Text style={[s.p, { marginBottom: sp.m }]}>Pick the colour of the Zovix icon on your phone.</Text>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: sp.m }}>
        {APP_ICON_NAMES.map((name) => {
          const on = name === picked;
          const waiting = on && name === pending;
          return (
            <Pressable
              key={name}
              accessibilityRole="radio"
              accessibilityState={{ selected: on, disabled: busy }}
              accessibilityLabel={`${name} app icon${on ? (waiting ? ', selected, changes when you leave the app' : ', selected') : ''}`}
              disabled={busy}
              onPress={() => choose(name)}
              style={({ pressed }) => ({ width: '33%', alignItems: 'center', marginBottom: sp.m, opacity: busy || pressed ? 0.6 : 1 })}
            >
              <View>
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
                {on && (
                  <View
                    style={{
                      position: 'absolute',
                      right: 0,
                      bottom: 0,
                      width: sp.xl,
                      height: sp.xl,
                      borderRadius: r.pill,
                      backgroundColor: c.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: c.onPrimary, fontSize: t.caption, fontWeight: '800' }}>✓</Text>
                  </View>
                )}
              </View>
              <Text numberOfLines={1} style={{ color: on ? c.primary : c.mute, fontSize: t.caption, fontWeight: '800', marginTop: sp.xs }}>
                {name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {/* Match my theme (only when the theme has a colour twin; otherwise the button says it uses the default icon) */}
      <Btn label={matchIconLabel(themeState.id)} alt busy={busy} onPress={() => choose(iconForTheme(themeState.id))} />
      {!!pending && <Btn label="Apply now (closes Zovix)" alt busy={busy} onPress={applyNow} />}
      <Text style={[s.p, { marginTop: sp.s }]}>The icon changes when you leave Zovix. The launcher may take a few seconds to update, and your home screen may flicker once.</Text>
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
