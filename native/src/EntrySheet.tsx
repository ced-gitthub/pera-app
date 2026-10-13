import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Btn } from './Btn';
import { Sheet } from './Sheet';
import { Chip } from './Tabs';
import { deleteEntry, loadTransferTarget, updateEntry } from './entries';
import { autoDismissMs, categoriesFor, formOf, switchType } from './entriesLogic';
import { planTxEdit, type Snapshot, type Tx, type TxEdit } from './logic';
import { c, r, s, sp, t } from './ui';

const TYPES: [TxEdit['type'], string][] = [
  ['expense', 'Spent'],
  ['income', 'Earned'],
  ['transfer', 'Moved'],
];

const Label = ({ text }: { text: string }) => <Text style={[s.p, { marginBottom: sp.xs }]}>{text}</Text>;

// Tap an entry to change it or delete it. Delete is immediate because the Undo bar can bring it straight back.
export function EntrySheet({
  tx,
  snap,
  onClose,
  onChanged,
}: {
  tx: Tx | null;
  snap: Snapshot;
  onClose: () => void;
  onChanged: (undo?: { row: Record<string, unknown> }) => void;
}) {
  const [f, setF] = useState<TxEdit | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const working = useRef(false); // blocks a second tap before React has re-rendered the disabled button

  useEffect(() => {
    setErr('');
    working.current = false;
    setBusy(false);
    if (!tx) return setF(null);
    setF(formOf(tx));
    if (tx.type !== 'transfer') return;
    let live = true;
    loadTransferTarget(tx.id)
      .then((to) => live && to && setF((p) => (p && p.type === 'transfer' && !p.toId ? { ...p, toId: to } : p)))
      .catch(() => {}); // the person can simply pick the account again
    return () => {
      live = false;
    };
  }, [tx]);

  const set = (patch: Partial<TxEdit>) => setF((p) => (p ? { ...p, ...patch } : p));

  const save = async () => {
    if (!tx || !f || working.current) return;
    const plan = planTxEdit(f, snap);
    if (!plan.ok) return setErr(plan.message);
    working.current = true;
    setBusy(true);
    setErr('');
    const e = await updateEntry(tx.id, plan.patch);
    working.current = false;
    setBusy(false);
    if (e) return setErr(e);
    onChanged();
    onClose();
  };

  const remove = async () => {
    if (!tx || working.current) return;
    working.current = true;
    setBusy(true);
    setErr('');
    const res = await deleteEntry(tx.id);
    working.current = false;
    setBusy(false);
    if ('error' in res) return setErr(res.error);
    onChanged({ row: res.row });
    onClose();
  };

  const cats = f ? categoriesFor(f.type, snap.categories) : [];
  return (
    <Sheet open={!!tx && !!f} title="Edit entry" onClose={onClose}>
      {f && (
        <View>
          <Label text="Type" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {TYPES.map(([k, label]) => (
              <Chip key={k} label={label} on={f.type === k} press={() => setF(switchType(f, k, snap.categories))} />
            ))}
          </View>
          <Label text="Amount (PHP)" />
          <TextInput
            style={s.input}
            value={f.amount}
            onChangeText={(v) => set({ amount: v.slice(0, 16) })}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={c.mute}
            accessibilityLabel="Amount"
          />
          <Label text="Date (YYYY-MM-DD)" />
          <TextInput
            style={s.input}
            value={f.date}
            onChangeText={(v) => set({ date: v.slice(0, 10) })}
            placeholder="2026-10-14"
            placeholderTextColor={c.mute}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Date"
          />
          <Label text="Description" />
          <TextInput
            style={s.input}
            value={f.description}
            onChangeText={(v) => set({ description: v.slice(0, 120) })}
            maxLength={120}
            placeholder="What was it for?"
            placeholderTextColor={c.mute}
            accessibilityLabel="Description"
          />
          <Label text={f.type === 'transfer' ? 'From account' : 'Account'} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {snap.accounts.map((a) => (
              <Chip key={a.id} label={a.name} on={f.accountId === a.id} press={() => set({ accountId: a.id })} />
            ))}
          </View>
          {f.type === 'transfer' && (
            <>
              <Label text="To account" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {snap.accounts.map((a) => (
                  <Chip key={a.id} label={`To ${a.name}`} on={f.toId === a.id} press={() => set({ toId: a.id })} />
                ))}
              </View>
            </>
          )}
          {f.type !== 'transfer' && (
            <>
              <Label text="Category" />
              {cats.length === 0 && <Text style={s.p}>No categories of this type yet.</Text>}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {cats.map((x) => (
                  <Chip key={x.id} label={x.name} on={f.categoryId === x.id} press={() => set({ categoryId: x.id })} />
                ))}
              </View>
            </>
          )}
          {!!err && <Text style={s.err}>{err}</Text>}
          <Btn label="Save changes" busy={busy} onPress={save} />
          <Btn label="Delete" danger busy={busy} onPress={remove} />
        </View>
      )}
    </Sheet>
  );
}

// A snackbar above the tab bar: "Entry deleted. Undo". It goes away by itself after about 8 seconds, unless a failed
// Undo left a message: then it stays (with Undo available to retry) until it works or the person dismisses it.
// lift = distance from the bottom edge (pass the tab bar height) so it never covers the tabs.
export function UndoBar({
  row,
  error,
  lift = 0,
  onUndo,
  onDismiss,
}: {
  row: Record<string, unknown> | null;
  error?: string;
  lift?: number;
  onUndo: () => void | Promise<void>;
  onDismiss: () => void;
}) {
  const { bottom } = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  useEffect(() => {
    setBusy(false);
    const ms = autoDismissMs(error);
    if (!row || ms === null) return;
    const id = setTimeout(() => dismiss.current(), ms);
    return () => clearTimeout(id);
  }, [row, error]);

  if (!row) return null;
  const undo = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onUndo();
    } finally {
      setBusy(false);
    }
  };
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        left: sp.l,
        right: sp.l,
        bottom: bottom + lift + sp.l,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: c.raised,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: r.s,
        paddingVertical: sp.m,
        paddingHorizontal: sp.l,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.ink, fontSize: t.body }}>Entry deleted.</Text>
        {!!error && <Text style={{ color: c.down, fontSize: t.body, marginTop: sp.xs }}>{error}</Text>}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Undo"
        disabled={busy}
        onPress={undo}
        hitSlop={sp.m}
        style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: sp.m, opacity: busy ? 0.5 : 1 }}
      >
        <Text style={{ color: c.primary, fontSize: t.body, fontWeight: '800' }}>
          {busy ? 'Restoring...' : error ? 'Try again' : 'Undo'}
        </Text>
      </Pressable>
    </View>
  );
}
