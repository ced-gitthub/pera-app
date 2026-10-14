import { useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';
import { Sheet } from './Sheet';
import { Btn } from './Btn';
import { finishAfterDeletion } from './signout';
import { ACCOUNT_DELETES, canDeleteAccount, sessionGone } from './deleteAccountLogic';
import { requestAccountDeletion } from './deleteAccountCore';
import { c, r, s, sp, t } from './ui';

const siteUrl = (Constants.expoConfig?.extra as { siteUrl: string }).siteUrl;

// Permanently deletes the account and everything in it. The server does the deleting (only it holds the key), after checking a recent sign-in and, if used, two-step verification.
export function DeleteAccount({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const sent = useRef(false); // one request only: a second tap must never send a second delete

  const unconfirmed = useRef(false); // the last answer was lost: the account may already be gone

  useEffect(() => {
    // a fresh sheet every time: the typed word and any old error never carry over, so the red button is never already armed
    setTyped('');
    setErr('');
    // (unconfirmed is NOT reset: if the last answer was lost the account may already be gone, even after the sheet is closed and reopened)
  }, [open]);

  const go = async () => {
    if (sent.current || !canDeleteAccount(typed)) return;
    sent.current = true;
    setBusy(true);
    setErr('');
    try {
      if (unconfirmed.current) {
        // Check first: if the server already deleted it, the old token no longer works and we are done.
        const { error } = await supabase.auth.getUser();
        if (sessionGone(error)) {
          await finishAfterDeletion();
          return;
        }
      }
      const { data } = await supabase.auth.getSession();
      const res = await requestAccountDeletion(fetch, siteUrl, data.session?.access_token ?? '', typed);
      if (res.kind === 'deleted') {
        await finishAfterDeletion(); // the account is gone; leave this phone signed out
        return;
      }
      unconfirmed.current = res.kind === 'unconfirmed';
      setErr(res.message);
    } catch {
      unconfirmed.current = true;
      setErr('Could not confirm that. Check your connection and try again.');
    } finally {
      sent.current = false; // always released, so the button can never stay stuck on busy
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} title="Delete my account" onClose={() => !busy && onClose()}>
      <View style={{ borderWidth: 1, borderColor: c.down, borderRadius: r.s, padding: sp.m, marginBottom: sp.m }}>
        {ACCOUNT_DELETES.map((line) => (
          <Text key={line} style={{ color: c.ink, fontSize: t.body, marginBottom: sp.s }}>
            • {line}
          </Text>
        ))}
      </View>
      <Text style={[s.p, { marginBottom: sp.xs }]}>Type DELETE to confirm</Text>
      <TextInput
        style={s.input}
        value={typed}
        onChangeText={setTyped}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="DELETE"
        placeholderTextColor={c.mute}
        accessibilityLabel="Type DELETE to confirm"
        editable={!busy}
      />
      {!!err && <Text style={s.err}>{err}</Text>}
      {canDeleteAccount(typed) ? (
        <Btn label="Delete my account forever" danger busy={busy} onPress={go} />
      ) : (
        <View
          style={[s.btn, { backgroundColor: c.raised, opacity: 0.5 }]}
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          accessibilityLabel="Delete my account forever, type DELETE first"
        >
          <Text style={s.btnAltText}>Type DELETE to enable</Text>
        </View>
      )}
    </Sheet>
  );
}
