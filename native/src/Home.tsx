import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMinor, manilaToday } from '../../src/core/money';
import type { Snapshot } from './data';
import type { Tx } from './logic';
import { gameView, homeView } from './logic';
import { QuickAdd, sign } from './QuickAdd';
import { CountUp, XpPop } from './Motion';
import { AccountsSheet } from './Settings';
import { c, e, r, s, sp, t } from './ui';

const CARD_W = 168;

export function Home({
  snap,
  refresh,
  name,
  onPick,
}: {
  snap: Snapshot;
  refresh: () => Promise<string>;
  name: string;
  onPick: (t: Tx) => void;
}) {
  const { bottom } = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState('');
  const [adding, setAdding] = useState(false);
  const [pop, setPop] = useState(0);
  const [cfg, setCfg] = useState(false);
  const v = homeView(snap);
  const g = gameView(snap.dates, snap.totalEntries, manilaToday());
  const catName = (id: string | null) => snap.categories.find((x) => x.id === id)?.name ?? '';
  const accName = (id: string | null) => snap.accounts.find((a) => a.id === id)?.name ?? '';
  const pull = async () => {
    setRefreshing(true);
    setErr(await refresh());
    setRefreshing(false);
  };
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        style={s.screen}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: bottom + sp.clear }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} tintColor={c.primary} />}
      >
        {!!err && <Text style={s.err}>{err}</Text>}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: sp.m }}>
          <Text style={s.h1}>{name ? `Hi, ${name} 👋` : 'Hi there 👋'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Home settings" onPress={() => setCfg(true)} style={s.chip}>
            <Text style={{ color: c.ink, fontSize: t.body }}>⚙︎ Edit</Text>
          </Pressable>
        </View>

        <View style={{ backgroundColor: c.hero.violet, borderRadius: r.l, padding: sp.xl, marginBottom: sp.l }}>
          <Text style={{ color: c.mute, fontSize: t.body }}>{v.hero === 'spendable' ? 'You can spend' : 'Total balance'}</Text>
          <CountUp
            value={v.hero === 'spendable' ? v.spendable : v.total}
            style={{ color: c.ink, fontSize: t.display, fontWeight: '800' }}
          />
          {v.hero === 'spendable' && (
            <View style={{ flexDirection: 'row', gap: sp.l, marginTop: sp.s }}>
              <Text style={{ color: c.reward, fontSize: t.body }}>🐷 Savings {formatMinor(v.savings)}</Text>
              <Text style={{ color: c.mute, fontSize: t.body }}>Total {formatMinor(v.total)}</Text>
            </View>
          )}
        </View>

        <Text style={s.h2}>Your accounts</Text>
        <FlatList
          data={v.cards}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(a) => a.id}
          snapToInterval={CARD_W + sp.m}
          decelerationRate="fast"
          style={{ marginBottom: sp.l, flexGrow: 0 }}
          ItemSeparatorComponent={() => <View style={{ width: sp.m }} />}
          renderItem={({ item }) => (
            <View style={[s.card, { width: CARD_W, marginBottom: 0 }]}>
              <Text style={{ color: c.mute, fontSize: t.caption }}>{item.counts_as_savings ? '🐷 Savings' : 'Spendable'}</Text>
              <Text style={{ color: c.ink, fontSize: t.lead, fontWeight: '700', marginTop: sp.xs }} numberOfLines={1}>
                {item.name}
              </Text>
              <Text
                style={{ color: (snap.balances[item.id] ?? 0) < 0 ? c.down : c.ink, fontSize: t.title, fontWeight: '800', marginTop: sp.s }}
              >
                {formatMinor(snap.balances[item.id] ?? 0)}
              </Text>
            </View>
          )}
          ListEmptyComponent={<Text style={s.p}>No accounts to show. Tap Edit to choose some.</Text>}
        />

        <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: sp.m }]}>
          <Text style={{ fontSize: e.s }}>{g.level.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.ink, fontSize: t.body, fontWeight: '700' }}>
              Lv {g.level.level} · {g.level.title}
            </Text>
            <View style={{ height: sp.s, borderRadius: r.pill, backgroundColor: c.raised, marginVertical: sp.xs, overflow: 'hidden' }}>
              <View style={{ height: sp.s, width: `${g.level.pct}%`, backgroundColor: c.reward }} />
            </View>
            <Text style={{ color: c.mute, fontSize: t.caption }}>
              {g.quest ? `${g.quest.emoji} ${g.quest.title}: ${g.quest.have}/${g.quest.need}` : 'All quests done. Nice.'}
            </Text>
          </View>
          <View style={s.chip}>
            <Text style={{ color: g.streak ? c.reward : c.mute, fontSize: t.body, fontWeight: '700' }}>🔥 {g.streak}</Text>
          </View>
        </View>

        <Text style={s.h2}>Recent</Text>
        {snap.recent.length === 0 && <Text style={s.p}>Nothing yet. Tap Add to log your first peso.</Text>}
        {snap.recent.slice(0, 6).map((x) => (
          <Pressable
            key={x.id}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${x.description || catName(x.category_id) || 'transfer'}`}
            onPress={() => onPick(x)}
            style={s.row}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontSize: t.body }}>{x.description || catName(x.category_id) || 'Transfer'}</Text>
              <Text style={{ color: c.mute, fontSize: t.caption }}>
                {x.transaction_date} · {accName(x.account_id)}
              </Text>
            </View>
            <Text
              style={{ color: x.type === 'income' ? c.up : x.type === 'expense' ? c.down : c.mute, fontWeight: '700', fontSize: t.body }}
            >
              {sign(x.type)}
              {formatMinor(x.amount_minor)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add an entry"
        onPress={() => setAdding(true)}
        style={({ pressed }) => ({
          position: 'absolute',
          right: sp.l,
          bottom: sp.l,
          backgroundColor: c.primary,
          borderRadius: r.pill,
          paddingVertical: sp.l,
          paddingHorizontal: sp.xl,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text style={{ color: c.onPrimary, fontSize: t.lead, fontWeight: '800' }}>＋ Add</Text>
      </Pressable>
      <XpPop play={pop} label="+5 XP" />
      <AccountsSheet open={cfg} onClose={() => setCfg(false)} snap={snap} refresh={refresh} />

      <Modal
        visible={adding}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="slide"
        onRequestClose={() => setAdding(false)}
      >
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: c.overlay }}>
          <Pressable style={{ flex: 1 }} onPress={() => setAdding(false)} accessibilityLabel="Close" />
          <View
            style={{
              backgroundColor: c.card,
              padding: sp.l,
              paddingBottom: bottom + sp.l,
              borderTopLeftRadius: r.l,
              borderTopRightRadius: r.l,
            }}
          >
            <Text style={s.h2}>What did you spend or earn?</Text>
            <QuickAdd
              snap={snap}
              onSaved={async () => {
                setAdding(false);
                setPop(Date.now());
                await refresh();
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
