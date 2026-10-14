import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMinor, manilaToday } from '../../src/core/money';
import type { Snapshot } from './data';
import type { Tx } from './logic';
import { gameView, homeTiles, homeView } from './logic';
import { QuickAdd, sign } from './QuickAdd';
import { Fab } from './Fab';
import { Sheet } from './Sheet';
import { useToast } from './Toast';
import { CoachTarget, useCoachScroll } from './Coach';
import { CountUp, XpPop } from './Motion';
import { Avatar } from './Avatar';
import { useProfile } from './profile';
import { AccountsSheet } from './Settings';
import { c, e, r, s, sp, t, TOUCH } from './ui';

export function Home({
  snap,
  refresh,
  name,
  onPick,
  onOpenAccounts,
}: {
  snap: Snapshot;
  refresh: () => Promise<string>;
  name: string;
  onPick: (t: Tx) => void;
  onOpenAccounts: () => void;
}) {
  const { bottom } = useSafeAreaInsets();
  const scroll = useCoachScroll();
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState('');
  const [adding, setAdding] = useState(false);
  const [pop, setPop] = useState(0);
  const [addDirty, setAddDirty] = useState(false); // typed text in Quick Add that is not saved yet
  const toast = useToast();
  const [addKey, setAddKey] = useState(0); // a new key resets Quick Add's typed text when the sheet closes
  const onAddDirty = useCallback((d: boolean) => setAddDirty(d), []);
  const [cfg, setCfg] = useState(false);
  const prof = useProfile(); // the person's avatar, shown next to the greeting
  const v = homeView(snap);
  const tiles = homeTiles(snap);
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
        {...scroll}
        style={s.screen}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: bottom + sp.clear }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} tintColor={c.primary} />}
      >
        {!!err && <Text style={s.err}>{err}</Text>}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: sp.m }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.m, flexShrink: 1 }}>
            <Avatar
              size={44}
              loading={!prof.state && !prof.failed}
              name={prof.state?.name ?? name}
              email={prof.state?.email}
              meta={prof.state?.profile}
            />
            <Text style={[s.h1, { flexShrink: 1 }]} numberOfLines={1}>
              {name ? `Hi, ${name}` : 'Hi there'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Home settings"
            onPress={() => setCfg(true)}
            hitSlop={sp.s}
            style={[s.chip, { minHeight: TOUCH, justifyContent: 'center' }]}
          >
            <Text style={{ color: c.ink, fontSize: t.body }}>⚙︎ Edit</Text>
          </Pressable>
        </View>

        <CoachTarget
          id="home:total"
          style={{ backgroundColor: c.hero.violet, borderRadius: r.l, paddingVertical: sp.l, paddingHorizontal: sp.xl, marginBottom: sp.m }}
        >
          <Text style={{ color: c.mute, fontSize: t.caption }}>Total balance</Text>
          <CountUp value={v.total} style={{ color: c.ink, fontSize: t.head, fontWeight: '800' }} />
          {v.owed > 0 && <Text style={{ color: c.down, fontSize: t.caption }}>Spendable already counts {formatMinor(v.owed)} you owe</Text>}
        </CoachTarget>

        <CoachTarget id="home:tiles" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.s, marginBottom: sp.s }}>
          {tiles.map((x) => {
            const label = x.kind === 'account' ? x.name : x.kind === 'spendable' ? 'Spendable' : '🐷 Savings';
            const edge = x.kind === 'spendable' ? c.up : x.kind === 'savings' ? c.reward : c.line;
            return (
              <Pressable
                key={x.kind === 'account' ? x.id : x.kind}
                accessibilityRole="button"
                accessibilityLabel={`${label} ${formatMinor(x.amount)}. Open accounts`}
                onPress={onOpenAccounts}
                style={({ pressed }) => ({
                  width: '48%',
                  flexGrow: 1,
                  backgroundColor: c.card,
                  borderRadius: r.s,
                  borderWidth: 1,
                  borderColor: edge,
                  paddingVertical: sp.m,
                  paddingHorizontal: sp.m,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: c.mute, fontSize: t.caption }} numberOfLines={1}>
                  {label}
                </Text>
                <Text
                  style={{ color: x.amount < 0 ? c.down : c.ink, fontSize: t.lead, fontWeight: '800' }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {formatMinor(x.amount)}
                </Text>
              </Pressable>
            );
          })}
        </CoachTarget>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="See all accounts"
          onPress={onOpenAccounts}
          hitSlop={sp.s}
          style={{ alignSelf: 'flex-end', minHeight: TOUCH, justifyContent: 'center', marginBottom: sp.s }}
        >
          <Text style={{ color: c.primary, fontSize: t.body, fontWeight: '700' }}>See all accounts ›</Text>
        </Pressable>

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
          <View style={s.chipStatic}>
            <Text style={{ color: g.streak ? c.reward : c.mute, fontSize: t.body, fontWeight: '700' }}>🔥 {g.streak}</Text>
          </View>
        </View>

        <CoachTarget id="home:recent" empty={snap.recent.length === 0}>
          <Text style={s.h2}>Recent</Text>
          {snap.recent.length > 0 && <Text style={[s.p, { marginBottom: sp.s }]}>Tap an entry to edit or delete it.</Text>}
          {snap.recent.length === 0 && <Text style={s.p}>Nothing yet. Tap Add to log your first peso.</Text>}
        </CoachTarget>
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
            <Text style={{ color: c.mute, fontSize: t.title, marginLeft: sp.s }}>›</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Fab label="＋ Add" onPress={() => setAdding(true)} />
      <XpPop play={pop} label="+5 XP" />
      <AccountsSheet open={cfg} onClose={() => setCfg(false)} snap={snap} refresh={refresh} />

      <QuickAdd
        key={addKey}
        snap={snap}
        onDirtyChange={onAddDirty}
        layout={(body, actions) => (
          <Sheet
            open={adding}
            title="What did you spend or earn?"
            onClose={() => {
              setAdding(false);
              setAddDirty(false);
              setAddKey((k) => k + 1);
            }}
            dirty={addDirty}
            footer={actions}
          >
            {body}
          </Sheet>
        )}
        onSaved={async () => {
          setAdding(false);
          setAddDirty(false);
          setPop(Date.now());
          toast('Entry saved');
          setAddKey((k) => k + 1); // reset the form NOW (before the reload): anything typed while the reload runs is never wiped
          const problem = await refresh(); // a failed reload is shown at the top of Home (the sheet is already closed)
          if (problem) setErr(problem);
          return problem; // QuickAdd gets it too
        }}
      />
    </View>
  );
}
