import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { c, s, sp, t, themeState } from './ui';
import { Btn } from './Btn';
import { ThemePicker, appliedStyle } from './ThemePicker';
import { AvatarPicker } from './AvatarPicker';
import { commitTheme, setTheme } from './themeStore';
import { markMakeItYoursSeen, saveProfile, useProfile } from './profile';
import type { ThemeId } from './themeLogic';
import type { Profile } from './profileLogic';

// A one-time friendly full-screen step after sign-up: pick a theme, pick an avatar. "Maybe later" skips it (it is all in Settings anyway).
// onDone fires once, whichever button is used; the saved-flag is written here too.
export function MakeItYours({ open, onDone }: { open: boolean; onDone: () => void }) {
  const { top, bottom } = useSafeAreaInsets();
  const { state, failed } = useProfile();
  const [theme, setThemeId] = useState<ThemeId>(themeState.id);
  const [p, setP] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const lock = useRef(false);
  const themeBusy = useRef(false);
  const picked = useRef(false);
  const mine = p ?? state?.profile ?? null;

  const pickTheme = async (id: ThemeId) => {
    if (themeBusy.current || id === themeState.id) return;
    themeBusy.current = true;
    setThemeId(id);
    picked.current = true;
    const problem = await setTheme(id);
    setErr(problem ?? '');
    setMsg('Applied');
    themeBusy.current = false;
  };
  const finish = async (save: boolean) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setErr('');
    if (save && mine && p) {
      const problem = await saveProfile(mine);
      if (problem) {
        setErr(problem);
        setBusy(false);
        lock.current = false;
        return;
      }
    }
    if (state) await markMakeItYoursSeen(state.uid);
    setBusy(false);
    lock.current = false;
    if (picked.current) commitTheme(); // the app repaints once in the new colours
    onDone();
  };
  return (
    <Modal visible={open} animationType="slide" statusBarTranslucent onRequestClose={() => finish(false)}>
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: Math.max(top, sp.xl), paddingHorizontal: sp.l }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: Math.max(bottom, sp.xl) + sp.xl }}>
          <Text style={s.h1} accessibilityRole="header">
            Make it yours
          </Text>
          <Text style={[s.p, { marginBottom: sp.l }]}>
            This is your app. Pick a look and an avatar. You can change both any time in Settings.
          </Text>
          <Text style={s.h2}>Theme</Text>
          <ThemePicker value={theme} onPick={pickTheme} />
          {!!msg && (
            <Text accessibilityLiveRegion="polite" style={appliedStyle()}>
              {msg}
            </Text>
          )}
          <Text style={[s.h2, { marginTop: sp.l }]}>Avatar</Text>
          {failed && <Text style={s.p}>Your avatar could not load. You can set it later in Settings.</Text>}
          {!failed && !mine && <ActivityIndicator color={c.primary} />}
          {!!mine && <AvatarPicker value={mine} name={state?.name || state?.email || ''} onChange={setP} />}
          {!!err && (
            <Text accessibilityRole="alert" style={s.err}>
              {err}
            </Text>
          )}
          <Btn label="Looks good" busy={busy} onPress={() => finish(true)} />
          <Btn label="Maybe later" alt busy={busy} onPress={() => finish(false)} />
          <Text style={[s.p, { textAlign: 'center', fontSize: t.caption }]}>Free, always. Nothing here costs anything.</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}
