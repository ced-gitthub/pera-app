import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Btn } from './Btn';
import { countFor, resetData } from './reset';
import { RESET_KINDS, RESET_LABEL, canConfirm, confirmPhrase, resetWarning, type ResetKind } from './resetLogic';
import { Sheet } from './Sheet';
import { c, r, s, sp, t } from './ui';

const NOUN: Record<ResetKind, string> = { entries: 'entries', budgets: 'budgets', goals: 'savings goals' };
const EMOJI: Record<ResetKind, string> = { entries: '🧾', budgets: '📊', goals: '🏆' };

// Safe bulk delete: pick what to clear, read what goes and what stays, then type the word before the red button works.
export function ResetData({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [counts, setCounts] = useState<Record<ResetKind, number | null> | null>(null);
  const [kind, setKind] = useState<ResetKind | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  const lock = useRef(false); // a second tap in the same moment must not send a second delete

  const load = useCallback(async () => {
    setCounts(null); // never leave old counts on screen while the new ones load
    const list = await Promise.all(RESET_KINDS.map((k) => countFor(k).catch(() => null)));
    setCounts({ entries: list[0], budgets: list[1], goals: list[2] });
  }, []);

  useEffect(() => {
    if (!open) return;
    setKind(null);
    setTyped('');
    setErr('');
    setDone('');
    setCounts(null);
    load();
  }, [open, load]);

  const count = kind && counts ? counts[kind] : null;
  const ready = !!kind && count !== null && canConfirm(typed, kind);
  const back = () => {
    if (busy) return;
    setKind(null);
    setErr('');
  };

  async function run() {
    if (!kind || lock.current || !canConfirm(typed, kind) || count === null) return;
    lock.current = true;
    setBusy(true);
    setErr('');
    const res = await resetData(kind);
    lock.current = false;
    setBusy(false);
    if (res.error) {
      // Show the real numbers again, on the list where they are.
      setErr(res.error);
      setKind(null);
      setTyped('');
      load();
      return;
    }
    const n = res.deleted; // what the server says it removed, not the earlier count
    setDone(n === null ? `Deleted all your ${NOUN[kind]}.` : `Deleted ${n} ${n === 1 ? 'item' : 'items'}: all your ${NOUN[kind]}.`);
    setKind(null);
    setTyped('');
    onDone();
    load();
  }

  return (
    <Sheet open={open} title={kind ? RESET_LABEL[kind] : 'Delete data'} onClose={busy ? () => {} : onClose}>
      {!!done && (
        <Text accessibilityLiveRegion="polite" style={s.ok}>
          {done}
        </Text>
      )}
      {!kind && !!err && (
        <Text accessibilityLiveRegion="polite" style={s.err}>
          {err}
        </Text>
      )}
      {!kind && (
        <>
          <Text style={s.p}>Start fresh. Pick what to clear. You will be asked to confirm before anything is deleted.</Text>
          {RESET_KINDS.map((k) => {
            const n = counts ? counts[k] : null;
            const empty = n === 0;
            return (
              <Pressable
                key={k}
                accessibilityRole="button"
                accessibilityLabel={`${RESET_LABEL[k]}${n === null ? '' : `, ${n} ${n === 1 ? 'item' : 'items'}`}`}
                accessibilityState={{ disabled: n === null || empty }}
                disabled={n === null || empty}
                onPress={() => {
                  setKind(k);
                  setTyped('');
                  setErr('');
                  setDone('');
                }}
                style={[s.card, { flexDirection: 'row', alignItems: 'center', marginTop: sp.m, opacity: n === null || empty ? 0.5 : 1 }]}
              >
                <Text style={{ fontSize: t.title, marginRight: sp.m }}>{EMOJI[k]}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.ink, fontSize: t.body, fontWeight: '700' }}>{RESET_LABEL[k]}</Text>
                  <Text style={s.p}>
                    {n === null
                      ? counts
                        ? 'Could not count right now. Close and reopen to check.'
                        : 'Counting...'
                      : empty
                        ? 'Nothing to delete'
                        : `${n} to delete`}
                  </Text>
                </View>
                {!empty && n !== null && <Text style={{ color: c.down, fontSize: t.lead }}>›</Text>}
              </Pressable>
            );
          })}
        </>
      )}
      {kind && (
        <>
          <View style={{ borderWidth: 1, borderColor: c.down, borderRadius: r.s, padding: sp.m, marginVertical: sp.m }}>
            <Text accessibilityRole="alert" style={{ color: c.ink, fontSize: t.body }}>
              {count === null ? 'Could not count your items. Go back and try again.' : resetWarning(kind, count)}
            </Text>
          </View>
          <Text style={{ color: c.ink, fontSize: t.body, fontWeight: '700', marginBottom: sp.s }}>
            Type {confirmPhrase(kind)} to confirm
          </Text>
          <TextInput
            accessibilityLabel={`Type ${confirmPhrase(kind)} to confirm`}
            value={typed}
            onChangeText={setTyped}
            editable={!busy}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder={confirmPhrase(kind)}
            placeholderTextColor={c.mute}
            style={s.input}
          />
          {ready ? (
            <Btn label={`Delete all ${NOUN[kind]}`} danger busy={busy} onPress={run} />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Delete all ${NOUN[kind]}. Type ${confirmPhrase(kind)} first.`}
              accessibilityState={{ disabled: true }}
              disabled
              style={[s.btn, s.btnDanger, { opacity: 0.35 }]}
            >
              <Text style={s.btnText}>{`Delete all ${NOUN[kind]}`}</Text>
            </Pressable>
          )}
          <Btn label="Go back" alt onPress={back} />
        </>
      )}
    </Sheet>
  );
}
