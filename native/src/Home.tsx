import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { formatMinor } from '../../src/core/money';
import { supabase } from './supabase';
import { load, preview, save, newRequestId, type Snapshot, type Preview } from './data';
import { Btn } from './Btn';
import { c, s } from './ui';

const sign = (t: string) => (t === 'income' ? '+' : t === 'expense' ? '-' : '');

export function Home() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [text, setText] = useState('');
  const [pv, setPv] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ bad: boolean; t: string } | null>(null);
  const rid = useRef(newRequestId()); // one id per entry: a retry or double-tap saves once

  const refresh = useCallback(async () => {
    try {
      setSnap(await load());
      setLoadErr('');
    } catch (e) {
      setLoadErr((e as Error).message);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!snap)
    return (
      <View style={s.screen}>
        <Text style={s.p}>{loadErr || 'Loading...'}</Text>
        {!!loadErr && <Btn label="Try again" onPress={refresh} />}
      </View>
    );

  const total = Object.values(snap.balances).reduce((a, b) => a + b, 0);
  const accName = (id: string | null) => snap.accounts.find((a) => a.id === id)?.name ?? '';
  const catName = (id: string | null) => snap.categories.find((x) => x.id === id)?.name ?? '';

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
    refresh();
  };
  const pull = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={s.screen}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} />}
    >
      <View style={[s.card, { backgroundColor: c.purple }]}>
        <Text style={{ color: '#fff', opacity: 0.8 }}>Total balance</Text>
        <Text accessibilityLabel={`Total balance ${formatMinor(total)}`} style={{ color: '#fff', fontSize: 34, fontWeight: '800' }}>
          {formatMinor(total)}
        </Text>
      </View>

      <View style={s.card}>
        <Text style={s.h2}>Quick add</Text>
        <TextInput
          style={s.input}
          value={text}
          onChangeText={(t) => {
            setText(t);
            setPv(null);
            rid.current = newRequestId();
          }}
          placeholder="lunch 150 gcash"
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
                <Text style={{ color: i.type === 'income' ? c.green : c.ink, fontWeight: '700' }}>
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

      <View style={s.card}>
        <Text style={s.h2}>Accounts</Text>
        {snap.accounts.map((a) => (
          <View key={a.id} style={s.row}>
            <Text style={{ color: c.ink }}>{a.name}</Text>
            <Text style={{ color: c.ink, fontWeight: '700' }}>{formatMinor(snap.balances[a.id] ?? 0)}</Text>
          </View>
        ))}
      </View>

      <View style={s.card}>
        <Text style={s.h2}>Recent</Text>
        {snap.recent.length === 0 && <Text style={s.p}>Nothing yet. Add your first entry above.</Text>}
        {snap.recent.map((t) => (
          <View key={t.id} style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink }}>{t.description || catName(t.category_id) || 'Transfer'}</Text>
              <Text style={s.p}>
                {t.transaction_date} · {accName(t.account_id)}
              </Text>
            </View>
            <Text style={{ color: t.type === 'income' ? c.green : c.ink, fontWeight: '700' }}>
              {sign(t.type)}
              {formatMinor(t.amount_minor)}
            </Text>
          </View>
        ))}
      </View>
      <Btn label="Log out" onPress={() => supabase.auth.signOut()} />
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
