import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Btn } from './Btn';
import { countFor, resetChoice } from './reset';
import {
  RESET_KINDS,
  RESET_LABEL,
  canConfirm,
  confirmPhrase,
  resetWarning,
  sumCounts,
  type Counts,
  type ResetChoice,
  type ResetKind,
} from './resetLogic';
import { Sheet } from './Sheet';
import { c, r, s, sp, t } from './ui';

const NOUN: Record<ResetChoice, string> = { all: 'records', entries: 'entries', budgets: 'budgets', goals: 'savings goals' };
const EMOJI: Record<ResetChoice, string> = { all: '🗑️', entries: '🧾', budgets: '📊', goals: '🏆' };
const CHOICES: ResetChoice[] = ['all', ...RESET_KINDS];
const BTN: Record<ResetChoice, string> = {
  all: 'Delete ALL my records',
  entries: 'Delete all entries',
  budgets: 'Delete all budgets',
  goals: 'Delete all savings goals',
};

// Safe bulk delete: pick what to clear, read what goes and what stays, then type the word before the red button works.
export function ResetData({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [choice, setChoice] = useState<ResetChoice | null>(null);
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
    setChoice(null);
    setTyped('');
    setErr('');
    setDone('');
    setCounts(null);
    load();
  }, [open, load]);

  const countOf = (k: ResetChoice): number | null => (!counts ? null : k === 'all' ? sumCounts(counts) : counts[k]);
  const count = choice ? countOf(choice) : null;
  const ready = !!choice && count !== null && canConfirm(typed, choice);
  const back = () => {
    if (busy) return;
    setChoice(null);
    setErr('');
  };

  async function run() {
    if (!choice || lock.current || !canConfirm(typed, choice) || count === null) return;
    lock.current = true;
    setBusy(true);
    setErr('');
    const res = await resetChoice(choice);
    lock.current = false;
    setBusy(false);
    if (res.error) {
      // Show the real numbers again, on the list where they are.
      setErr(res.error);
      setChoice(null);
      setTyped('');
      load();
      return;
    }
    const n = res.deleted; // what the server says it removed, not the earlier count
    const what = choice === 'all' ? 'all your entries, budgets and savings goals' : `all your ${NOUN[choice]}`;
    setDone(n === null ? `Deleted ${what}.` : `Deleted ${n} ${n === 1 ? 'item' : 'items'}: ${what}.`);
    setChoice(null);
    setTyped('');
    onDone();
    load();
  }

  return (
    <Sheet open={open} title={choice ? RESET_LABEL[choice] : 'Delete data'} onClose={busy ? () => {} : onClose}>
      {!!done && (
        <Text accessibilityLiveRegion="polite" style={s.ok}>
          {done}
        </Text>
      )}
      {!choice && !!err && (
        <Text accessibilityLiveRegion="polite" style={s.err}>
          {err}
        </Text>
      )}
      {!choice && (
        <>
          <Text style={s.p}>Start fresh. Pick what to clear. You will be asked to confirm before anything is deleted.</Text>
          {CHOICES.map((k) => {
            const n = countOf(k);
            const empty = n === 0;
            return (
              <Pressable
                key={k}
                accessibilityRole="button"
                accessibilityLabel={`${RESET_LABEL[k]}${n === null ? '' : `, ${n} ${n === 1 ? 'item' : 'items'}`}`}
                accessibilityState={{ disabled: n === null || empty }}
                disabled={n === null || empty}
                onPress={() => {
                  setChoice(k);
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
      {choice && (
        <>
          <View
            style={{ borderWidth: choice === 'all' ? 3 : 1, borderColor: c.down, borderRadius: r.s, padding: sp.m, marginVertical: sp.m }}
          >
            <Text accessibilityRole="alert" style={{ color: c.ink, fontSize: t.body }}>
              {count === null
                ? 'Could not count your items. Go back and try again.'
                : resetWarning(choice, choice === 'all' && counts ? counts : count)}
            </Text>
          </View>
          <Text style={{ color: c.ink, fontSize: t.body, fontWeight: '700', marginBottom: sp.s }}>
            Type {confirmPhrase(choice)} to confirm
          </Text>
          <TextInput
            accessibilityLabel={`Type ${confirmPhrase(choice)} to confirm`}
            value={typed}
            onChangeText={setTyped}
            editable={!busy}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder={confirmPhrase(choice)}
            placeholderTextColor={c.mute}
            style={s.input}
          />
          {ready ? (
            <Btn label={BTN[choice]} danger busy={busy} onPress={run} />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${BTN[choice]}. Type ${confirmPhrase(choice)} first.`}
              accessibilityState={{ disabled: true }}
              disabled
              style={[s.btn, s.btnDanger, { opacity: 0.35 }]}
            >
              <Text style={s.btnText}>{BTN[choice]}</Text>
            </Pressable>
          )}
          <Btn label="Go back" alt onPress={back} />
        </>
      )}
    </Sheet>
  );
}
