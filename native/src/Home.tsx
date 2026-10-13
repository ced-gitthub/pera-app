import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { formatMinor } from '../../src/core/money';
import type { Snapshot } from './data';
import { QuickAdd, sign } from './QuickAdd';
import { c, s, sp, t } from './ui';

export function Home({ snap, refresh, name }: { snap: Snapshot; refresh: () => Promise<string>; name: string }) {
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState('');
  const total = Object.values(snap.balances).reduce((a, b) => a + b, 0);
  const accName = (id: string | null) => snap.accounts.find((a) => a.id === id)?.name ?? '';
  const catName = (id: string | null) => snap.categories.find((x) => x.id === id)?.name ?? '';
  const pull = async () => {
    setRefreshing(true);
    setErr(await refresh());
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={s.screen}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} />}
    >
      {!!err && <Text style={s.err}>{err}</Text>}
      <Text style={[s.h1, { marginBottom: sp.m }]}>{name ? `Hi, ${name} 👋` : 'Hi there 👋'}</Text>
      <View style={[s.card, { backgroundColor: c.purple }]}>
        <Text style={{ color: c.white, opacity: 0.8 }}>Total balance</Text>
        <Text accessibilityLabel={`Total balance ${formatMinor(total)}`} style={{ color: c.white, fontSize: t.display, fontWeight: '800' }}>
          {formatMinor(total)}
        </Text>
      </View>

      <View style={s.card}>
        <Text style={s.h2}>Quick add</Text>
        <QuickAdd snap={snap} onSaved={refresh} />
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
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
