import { useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { formatMinor } from '../../src/core/money';
import { preview, save, newRequestId, type Snapshot, type Preview } from './data';
import { Btn } from './Btn';
import { c, s } from './ui';

export const sign = (t: string) => (t === 'income' ? '+' : t === 'expense' ? '-' : '');

// Type a line, check the preview, save. Shared by Home and the first-run wizard.
export function QuickAdd({ snap, onSaved }: { snap: Snapshot; onSaved: () => void | Promise<string | void> }) {
  const [text, setText] = useState('');
  const [pv, setPv] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ bad: boolean; t: string } | null>(null);
  const rid = useRef(newRequestId()); // one id per entry: a retry or double-tap saves once

  const check = () => {
    if (!text.trim()) return setMsg({ bad: true, t: 'Type what you spent or earned, e.g. "lunch 150 gcash".' });
    rid.current = newRequestId(); // a new preview is a new entry; the id is kept only for retries of the same preview
    const p = preview(text, snap);
    setPv(p.items.length ? p : null);
    setMsg(p.problems.length ? { bad: true, t: p.problems.join('\n') } : null);
  };
  const confirm = async () => {
    if (!pv) return;
    setBusy(true);
    const e = await save(rid.current, pv.items, snap).catch(() => 'Not saved: could not reach the server. Your entry is kept; try again.');
    setBusy(false);
    if (e) return setMsg({ bad: true, t: e });
    rid.current = newRequestId();
    setText('');
    setPv(null);
    setMsg({ bad: false, t: `Saved ${pv.items.length} ${pv.items.length === 1 ? 'entry' : 'entries'}.` });
    const reloaded = await onSaved(); // wait for the reload, and say so if it failed (the entry IS saved)
    if (typeof reloaded === 'string' && reloaded) setMsg({ bad: true, t: `Saved, but could not refresh the screen: ${reloaded}` });
  };

  return (
    <View>
      <TextInput
        style={s.input}
        value={text}
        onChangeText={(t) => {
          setText(t);
          setPv(null);
          rid.current = newRequestId();
        }}
        placeholder="lunch 150 gcash"
        placeholderTextColor={c.mute}
        accessibilityLabel="Transaction"
        maxLength={500}
        onSubmitEditing={check}
        returnKeyType="done"
      />
      {pv ? (
        <>
          {pv.items.map((i, k) => (
            <View key={k} style={s.row}>
              <Text style={{ color: c.ink, flex: 1 }}>
                {i.type === 'transfer' ? `${i.account} → ${i.to_account}` : `${i.category} · ${i.account || 'Cash'}`} · {i.date}
              </Text>
              <Text style={{ color: i.type === 'income' ? c.up : i.type === 'expense' ? c.down : c.ink, fontWeight: '700' }}>
                {sign(i.type)}
                {formatMinor(i.amount_minor)}
              </Text>
            </View>
          ))}
          <Btn label="Save" busy={busy} onPress={confirm} />
        </>
      ) : (
        <Btn label="Add" alt onPress={check} />
      )}
      {msg && <Text style={msg.bad ? s.err : s.ok}>{msg.t}</Text>}
    </View>
  );
}
