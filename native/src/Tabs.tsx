import { useCallback, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { formatMinor } from '../../src/core/money';
import { supabase } from './supabase';
import type { Snapshot } from './data';
import { loadActivity, loadBudgets, loadGoals } from './extra';
import { sign } from './QuickAdd';
import { Btn } from './Btn';
import { c, s, sp, t, e, r } from './ui';

// A small loader for the tab screens: loading, error (with retry) and empty states are handled once, here.
function useList<T>(fetcher: () => Promise<T[]>, deps: unknown[]) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    setBusy(true);
    try {
      setRows(await fetcher());
      setErr('');
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    reload();
  }, [reload]);
  return { rows, err, busy, reload };
}

function Page(p: {
  emoji: string;
  title: string;
  line: string;
  tint: string;
  busy: boolean;
  reload: () => void;
  err: string;
  children: React.ReactNode;
}) {
  const { top } = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1 }} refreshControl={<RefreshControl refreshing={p.busy} onRefresh={p.reload} />}>
      <View
        style={{
          backgroundColor: p.tint,
          paddingTop: top + sp.l,
          paddingHorizontal: sp.l,
          paddingBottom: sp.xl,
          borderBottomLeftRadius: r.l,
          borderBottomRightRadius: r.l,
        }}
      >
        <Text style={{ fontSize: e.s }}>{p.emoji}</Text>
        <Text style={{ color: c.white, fontSize: t.head, fontWeight: '800' }}>{p.title}</Text>
        <Text style={{ color: c.white, opacity: 0.9 }}>{p.line}</Text>
      </View>
      <View style={{ padding: sp.l }}>
        {!!p.err && (
          <>
            <Text style={s.err}>{p.err}</Text>
            <Btn label="Try again" onPress={p.reload} />
          </>
        )}
        {p.children}
      </View>
    </ScrollView>
  );
}

const Bar = ({ pct, color }: { pct: number; color: string }) => (
  <View style={{ height: 12, borderRadius: r.pill, backgroundColor: c.line, overflow: 'hidden', marginVertical: sp.s }}>
    <View style={{ height: 12, width: `${pct}%`, backgroundColor: color }} />
  </View>
);

export function Activity({ snap }: { snap: Snapshot }) {
  const l = useList(loadActivity, []);
  const acc = (id: string | null) => snap.accounts.find((a) => a.id === id)?.name ?? '';
  const cat = (id: string | null) => snap.categories.find((x) => x.id === id)?.name ?? '';
  return (
    <Page emoji="🧾" title="Activity" line="Your latest 200 entries." tint={c.hero.indigo} {...l}>
      {l.rows === null && !l.err && <Text style={s.p}>Loading...</Text>}
      {l.rows?.length === 0 && <Text style={s.p}>Nothing yet. Add your first entry on Home.</Text>}
      {l.rows?.map((t) => (
        <View key={t.id} style={[s.card, { flexDirection: 'row', justifyContent: 'space-between', marginBottom: sp.s }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.ink, fontWeight: '700' }}>{t.description || cat(t.category_id) || 'Transfer'}</Text>
            <Text style={s.p}>
              {t.transaction_date} · {cat(t.category_id) || 'Transfer'} · {acc(t.account_id)}
            </Text>
          </View>
          <Text style={{ color: t.type === 'income' ? c.green : c.ink, fontWeight: '800' }}>
            {sign(t.type)}
            {formatMinor(t.amount_minor)}
          </Text>
        </View>
      ))}
    </Page>
  );
}

export function Budgets({ snap }: { snap: Snapshot }) {
  const l = useList(() => loadBudgets(snap), [snap]);
  return (
    <Page emoji="🎯" title="Budgets" line="What is left to spend this month." tint={c.hero.orange} {...l}>
      {l.rows === null && !l.err && <Text style={s.p}>Loading...</Text>}
      {l.rows?.length === 0 && <Text style={s.p}>No budgets this month yet.</Text>}
      {l.rows?.map((b) => (
        <View key={b.id} style={s.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={s.h2}>{b.name}</Text>
            <Text style={{ color: b.over ? c.red : c.ink, fontWeight: '800' }}>
              {b.over ? `Over by ${formatMinor(b.overBy)}` : `${formatMinor(b.left)} left`}
            </Text>
          </View>
          <Bar pct={b.pct} color={b.over ? c.red : b.pct >= 80 ? c.hero.gold : c.green} />
          <Text style={s.p}>
            {formatMinor(b.spent)} of {formatMinor(b.limit)}
          </Text>
        </View>
      ))}
    </Page>
  );
}

export function Goals({ snap }: { snap: Snapshot }) {
  const l = useList(() => loadGoals(snap), [snap]);
  return (
    <Page emoji="🏆" title="Goals" line="Watch them fill up." tint={c.hero.gold} {...l}>
      {l.rows === null && !l.err && <Text style={s.p}>Loading...</Text>}
      {l.rows?.length === 0 && <Text style={s.p}>No goals yet.</Text>}
      {l.rows?.map((g) => (
        <View key={g.id} style={s.card}>
          <Text style={s.h2}>
            {g.emoji} {g.name} {g.reached ? '🎉' : ''}
          </Text>
          <Bar pct={g.pct} color={g.reached ? c.green : c.purple} />
          <Text style={s.p}>
            {g.unavailable
              ? 'Progress unavailable right now. Pull down to retry.'
              : `${formatMinor(g.have)} of ${formatMinor(g.target)} · ${g.pct}%${g.reached ? '' : ` · ${formatMinor(g.remaining)} to go`}`}
          </Text>
        </View>
      ))}
    </Page>
  );
}

export function More({ onReplay }: { onReplay: () => void }) {
  return (
    <Page emoji="⚙️" title="Settings" line="Tutorial and account." tint={c.purple} busy={false} reload={() => {}} err="">
      <Btn label="Show the tutorial again" alt onPress={onReplay} />
      <Btn label="Log out" onPress={() => supabase.auth.signOut()} />
      <Text style={[s.p, { textAlign: 'center', marginTop: sp.m }]}>Zovix native 0.5.1</Text>
    </Page>
  );
}

export function TabBar({ tab, setTab }: { tab: string; setTab: (t: string) => void }) {
  const { bottom } = useSafeAreaInsets();
  const items = [
    ['home', '🏠', 'Home'],
    ['activity', '🧾', 'Activity'],
    ['budgets', '🎯', 'Budgets'],
    ['goals', '🏆', 'Goals'],
    ['more', '⚙️', 'Settings'],
  ];
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: c.white,
        borderTopWidth: 1,
        borderTopColor: c.line,
        paddingBottom: bottom + sp.s,
        paddingTop: sp.s,
      }}
    >
      {items.map(([id, e, label]) => (
        <Pressable
          key={id}
          accessibilityRole="tab"
          accessibilityLabel={label}
          accessibilityState={{ selected: tab === id }}
          onPress={() => setTab(id)}
          style={{ flex: 1, alignItems: 'center', paddingVertical: sp.s }}
        >
          <Text style={{ fontSize: t.title }}>{e}</Text>
          <Text style={{ fontSize: t.caption, fontWeight: tab === id ? '800' : '500', color: tab === id ? c.purple : c.mute }}>
            {label}
          </Text>
          {tab === id && <View style={{ width: 6, height: 6, borderRadius: r.pill, backgroundColor: c.yellow, marginTop: sp.xs }} />}
        </Pressable>
      ))}
    </View>
  );
}
