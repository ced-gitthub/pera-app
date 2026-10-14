import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { c, s, sp, t, themeState } from './ui';
import { Sheet } from './Sheet';
import { Btn } from './Btn';
import { ThemePicker, appliedStyle } from './ThemePicker';
import { AvatarPicker } from './AvatarPicker';
import { AppIconSection } from './AppIconSection';
import { commitTheme, setTheme } from './themeStore';
import { saveName, saveProfile, useProfile } from './profile';
import { adoptServerProfile, saveButtonBusy } from './profileFlow';
import {
  PROFILE_SAVED_TOAST,
  STATUS_MAX,
  UNSAVED_DISCARD,
  UNSAVED_KEEP,
  UNSAVED_SAVE,
  UNSAVED_TEXT,
  UNSAVED_TITLE,
  cleanStatus,
  isProfileDirty,
  type Profile,
} from './profileLogic';
import { cleanName } from './logic';
import type { ThemeId } from './themeLogic';

export type Flair = { level: number; streak: number };
type Tab = 'theme' | 'profile';
// What the profile editor tells the sheet: are there unsaved changes, is a save running, and a way to save (true when it worked).
type Editor = { dirty: boolean; busy: boolean; save: () => Promise<boolean> };

function TabChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        s.chip,
        { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
        on && { borderColor: c.primary, borderWidth: 2 },
      ]}
    >
      <Text style={{ color: on ? c.primary : c.ink, fontSize: t.body, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}

function ThemeSection({ onChanged }: { onChanged: () => void }) {
  const [id, setId] = useState<ThemeId>(themeState.id);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const pick = async (next: ThemeId) => {
    if (busy.current || next === themeState.id) return;
    busy.current = true;
    setId(next);
    const problem = await setTheme(next); // colours change right now; the account sync can fail without undoing it
    onChanged();
    setErr(problem ?? '');
    setMsg('Applied');
    timer.current = setTimeout(() => setMsg(''), 1800);
    busy.current = false;
  };
  return (
    <View>
      <Text style={[s.p, { marginBottom: sp.m }]}>Pick a look. It changes right away and follows you to other phones.</Text>
      <ThemePicker value={id} onPick={pick} />
      {!!msg && (
        <Text accessibilityLiveRegion="polite" style={appliedStyle()}>
          {msg}
        </Text>
      )}
      {!!err && <Text style={s.err}>{err}</Text>}
      <AppIconSection />
    </View>
  );
}

function ProfileSection({ flair, onSaved, onEditor }: { flair?: Flair; onSaved: () => void; onEditor: (e: Editor) => void }) {
  const { state, failed, reload } = useProfile();
  const [p, setP] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  const [saved, setSaved] = useState<{ name: string; profile: Profile } | null>(null); // what is stored right now
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [err, setErr] = useState('');
  const dirty = !!p && !!saved && isProfileDirty(saved, { name, status, profile: p });
  useEffect(() => {
    // the form follows the account's copy until the person starts editing; then it is frozen (never overwritten while typing)
    if (!state || !adoptServerProfile({ dirty, hasSaved: !!saved })) return;
    setP(state.profile);
    setName(state.name);
    setStatus(state.profile.status);
    setSaved({ name: state.name, profile: state.profile });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  const save = async (): Promise<boolean> => {
    if (lock.current || !p || !state) return false;
    const nm = cleanName(name);
    if (!nm.ok) return setErr(nm.message), false;
    const st = cleanStatus(status);
    if (!st.ok) return setErr(st.message), false;
    lock.current = true;
    setBusy(true);
    setErr('');
    const problem = (nm.name !== (saved?.name ?? state.name) ? await saveName(nm.name) : null) ?? (await saveProfile({ ...p, status: st.status }));
    lock.current = false;
    setBusy(false);
    if (problem) return setErr(problem), false;
    const next = { ...p, status: st.status };
    setP(next);
    setName(nm.name);
    setStatus(st.status);
    setSaved({ name: nm.name, profile: next });
    onSaved();
    reload();
    return true;
  };
  // keep the sheet informed (it owns the pinned Save button and the Done check)
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    onEditor({ dirty, busy, save: () => saveRef.current() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, busy]);
  if (failed && !state) return <Text style={s.err}>Could not load your profile. Check your connection.</Text>;
  if (!state || !p) return <ActivityIndicator color={c.primary} />;
  return (
    <View>
      <AvatarPicker value={p} name={name || state.email} onChange={setP} />
      {!!flair && (
        <Text style={[s.p, { marginBottom: sp.m }]} accessibilityLabel={`Level ${flair.level}, ${flair.streak} day streak`}>
          ⭐ Level {flair.level} 🔥 {flair.streak}-day streak
        </Text>
      )}
      <Text style={s.p}>Display name</Text>
      <TextInput
        accessibilityLabel="Display name"
        style={s.input}
        value={name}
        onChangeText={setName}
        maxLength={40}
        autoCapitalize="words"
        placeholder="Your name"
        placeholderTextColor={c.mute}
      />
      <Text style={s.p}>
        Status (up to {STATUS_MAX} characters, no links) {status.length}/{STATUS_MAX}
      </Text>
      <TextInput
        accessibilityLabel="Status"
        style={s.input}
        value={status}
        onChangeText={setStatus}
        maxLength={STATUS_MAX}
        placeholder="Saving for a new phone"
        placeholderTextColor={c.mute}
      />
      {!!err && (
        <Text accessibilityRole="alert" style={s.err}>
          {err}
        </Text>
      )}
    </View>
  );
}

// "Make it yours": theme and profile in one sheet. `onChanged` fires after something was applied or saved (so the host can refresh a name or avatar).
// The rest of the app re-reads its colours when the sheet closes (it remounts once), so the picker itself can stay open while you try themes.
export function Personalize({
  open,
  onClose,
  onChanged,
  flair,
  initialTab = 'theme',
}: {
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
  flair?: Flair;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [, force] = useState(0);
  const changed = useRef({ theme: false, profile: false });
  const [editor, setEditor] = useState<Editor | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (toastTimer.current && clearTimeout(toastTimer.current)), []);
  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setToast(null);
      changed.current = { theme: false, profile: false };
    }
  }, [open, initialTab]);
  const touched = (kind: 'theme' | 'profile') => {
    changed.current[kind] = true;
    force((n) => n + 1); // repaint this sheet in the new colours
  };
  const finish = () => {
    onClose();
    const { theme, profile } = changed.current;
    changed.current = { theme: false, profile: false };
    if (theme) commitTheme();
    if (theme || profile) onChanged?.();
  };
  // Done: if the profile has unsaved changes, ask first (Save, Discard or Keep editing)
  const close = () => {
    if (!editor?.dirty) return finish();
    Alert.alert(UNSAVED_TITLE, UNSAVED_TEXT, [
      { text: UNSAVED_KEEP, style: 'cancel' },
      { text: UNSAVED_DISCARD, style: 'destructive', onPress: finish },
      {
        text: UNSAVED_SAVE,
        onPress: async () => {
          if (await editor.save()) finish();
          else setTab('profile'); // the problem is shown on the Profile tab
        },
      },
    ]);
  };
  const savedPopup = () => {
    touched('profile');
    setToast(PROFILE_SAVED_TOAST);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };
  return (
    <Sheet
      open={open}
      title="Make it yours"
      onClose={close}
      toast={toast}
      footer={
        tab === 'profile' ? <Btn label="Save profile" busy={saveButtonBusy(editor)} onPress={() => void editor?.save()} /> : undefined
      }
    >
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: sp.s, marginBottom: sp.m }}>
        <TabChip label="Theme" on={tab === 'theme'} onPress={() => setTab('theme')} />
        <TabChip label="Profile" on={tab === 'profile'} onPress={() => setTab('profile')} />
      </View>
      {/* both tabs stay mounted, so unsaved profile edits are never lost by looking at the Theme tab */}
      <View style={{ display: tab === 'theme' ? 'flex' : 'none' }}>
        <ThemeSection onChanged={() => touched('theme')} />
      </View>
      <View style={{ display: tab === 'profile' ? 'flex' : 'none' }}>
        <ProfileSection flair={flair} onSaved={savedPopup} onEditor={setEditor} />
      </View>
    </Sheet>
  );
}
