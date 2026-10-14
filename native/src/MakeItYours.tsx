import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { c, s, sp, t, themeState } from './ui';
import { HeaderClose } from './Sheet';
import { useToast } from './Toast';
import { supabase } from './supabase';
import { createOnce, seenUid } from './csvMineLogic';
import { UNSAVED_TEXT_ANY, unsavedButtons } from './unsaved';
import { Btn } from './Btn';
import { ThemePicker, appliedStyle } from './ThemePicker';
import { AvatarPicker } from './AvatarPicker';
import { commitTheme, setTheme } from './themeStore';
import { markMakeItYoursSeen, saveProfile, useProfile } from './profile';
import type { ThemeId } from './themeLogic';
import { PROFILE_SAVED_TOAST, UNSAVED_TITLE, isProfileDirty, type Profile } from './profileLogic';

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
  const toast = useToast();
  const leave = useRef(createOnce()).current; // however the screen closes, it is left exactly once
  // unsaved: an avatar change that has not been saved yet
  const dirty = !!p && !!state && isProfileDirty({ name: state.name, profile: state.profile }, { name: state.name, status: p.status, profile: p });

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
  // true = the screen was left. A failed save keeps the person here with the problem shown.
  const finish = async (save: boolean): Promise<boolean> => {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setErr('');
    if (save && mine && p) {
      const problem = await saveProfile(mine);
      if (problem) {
        setErr(problem);
        setBusy(false);
        lock.current = false;
        return false;
      }
      toast(PROFILE_SAVED_TOAST);
    }
    // mark it seen even if the profile never loaded (offline): the local session still knows who this is
    let uid = seenUid(state?.uid, undefined);
    if (!uid) {
      try {
        uid = seenUid(undefined, (await supabase.auth.getSession()).data.session?.user.id);
      } catch {
        uid = null;
      }
    }
    let left = false;
    leave(() => {
      left = true;
      if (uid) void markMakeItYoursSeen(uid);
      if (picked.current) commitTheme(); // the app repaints once in the new colours
      onDone();
    });
    setBusy(false);
    lock.current = false;
    return left;
  };
  // Maybe later and the back button: ask first when the avatar has unsaved changes
  const later = () => {
    if (dirty) Alert.alert(UNSAVED_TITLE, UNSAVED_TEXT_ANY, unsavedButtons({ onClose: () => void finish(false), onSave: () => finish(true) }));
    else void finish(false);
  };
  return (
    <Modal visible={open} animationType="slide" statusBarTranslucent onRequestClose={later}>
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: Math.max(top, sp.xl), paddingHorizontal: sp.l }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: sp.s }}>
          <Text style={[s.h1, { flex: 1 }]} accessibilityRole="header">
            Make it yours
          </Text>
          <HeaderClose label="Maybe later" onPress={later} />
        </View>
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: sp.l }}>
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
        </ScrollView>
        <View style={{ paddingTop: sp.m, paddingBottom: Math.max(bottom, sp.xl) }}>
          <Btn label="Looks good" busy={busy} onPress={() => void finish(true)} />
          <Text style={[s.p, { textAlign: 'center', fontSize: t.caption }]}>Free, always. Nothing here costs anything.</Text>
        </View>
      </View>
    </Modal>
  );
}
