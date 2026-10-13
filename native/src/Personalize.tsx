import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { c, s, sp, t, themeState } from './ui';
import { Sheet } from './Sheet';
import { Btn } from './Btn';
import { ThemePicker, appliedStyle } from './ThemePicker';
import { AvatarPicker } from './AvatarPicker';
import { commitTheme, setTheme } from './themeStore';
import { saveName, saveProfile, useProfile } from './profile';
import { STATUS_MAX, cleanStatus, type Profile } from './profileLogic';
import { cleanName } from './logic';
import type { ThemeId } from './themeLogic';

export type Flair = { level: number; streak: number };
type Tab = 'theme' | 'profile';

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
    </View>
  );
}

function ProfileSection({ flair, onChanged }: { flair?: Flair; onChanged: () => void }) {
  const { state, failed, reload } = useProfile();
  const [p, setP] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  useEffect(() => {
    if (!state) return;
    setP(state.profile);
    setName(state.name);
    setStatus(state.profile.status);
  }, [state]);
  if (failed) return <Text style={s.err}>Could not load your profile. Check your connection.</Text>;
  if (!state || !p) return <ActivityIndicator color={c.primary} />;
  const save = async () => {
    if (lock.current) return;
    const nm = cleanName(name);
    if (!nm.ok) return setErr(nm.message);
    const st = cleanStatus(status);
    if (!st.ok) return setErr(st.message);
    lock.current = true;
    setBusy(true);
    setErr('');
    setOk('');
    const problem = (nm.name !== state.name ? await saveName(nm.name) : null) ?? (await saveProfile({ ...p, status: st.status }));
    lock.current = false;
    setBusy(false);
    if (problem) return setErr(problem);
    setOk('Saved');
    onChanged();
    reload();
  };
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
      {!!ok && (
        <Text accessibilityLiveRegion="polite" style={s.ok}>
          {ok}
        </Text>
      )}
      <Btn label="Save profile" busy={busy} onPress={save} />
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
  useEffect(() => {
    if (open) {
      setTab(initialTab);
      changed.current = { theme: false, profile: false };
    }
  }, [open, initialTab]);
  const touched = (kind: 'theme' | 'profile') => {
    changed.current[kind] = true;
    force((n) => n + 1); // repaint this sheet in the new colours
  };
  const close = () => {
    onClose();
    const { theme, profile } = changed.current;
    changed.current = { theme: false, profile: false };
    if (theme) commitTheme();
    if (theme || profile) onChanged?.();
  };
  return (
    <Sheet open={open} title="Make it yours" onClose={close}>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: sp.s, marginBottom: sp.m }}>
        <TabChip label="Theme" on={tab === 'theme'} onPress={() => setTab('theme')} />
        <TabChip label="Profile" on={tab === 'profile'} onPress={() => setTab('profile')} />
      </View>
      {tab === 'theme' ? (
        <ThemeSection onChanged={() => touched('theme')} />
      ) : (
        <ProfileSection flair={flair} onChanged={() => touched('profile')} />
      )}
    </Sheet>
  );
}
