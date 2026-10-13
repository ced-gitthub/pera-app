import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMinor } from '../../src/core/money';
import type { Snapshot } from './data';
import { loadActivity } from './extra';
import { filterActivity, type ActivityFilter, type Tx } from './logic';
import { sign } from './QuickAdd';
import { ListSkeleton } from './Skeleton';
import { Sheet } from './Sheet';
import { Btn } from './Btn';
import { Fab } from './Fab';
import { CoachTarget, useCoachScroll } from './Coach';
import { c, s, sp, t, e, r } from './ui';

// A small loader for the tab screens: skeleton while loading, an error with Try again, and the rows. Empty states are drawn by each screen.
export function useList<T>(fetcher: () => Promise<T[]>, deps: unknown[]) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    setBusy(true);
    try {
      setRows(await fetcher());
      setErr('');
    } catch (x) {
      setErr((x as Error).message);
    }
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    reload();
  }, [reload]);
  return { rows, err, busy, reload };
}

// The banner every tab shares: emoji, title, one friendly line, and the tab's own gear.
export function Page(p: {
  emoji: string;
  title: string;
  line: string;
  tint: string;
  busy: boolean;
  reload: () => void;
  err: string;
  onGear?: () => void;
  gearLabel?: string;
  gearId?: string;
  loading?: boolean;
  fab?: { label: string; onPress: () => void };
  children: ReactNode;
}) {
  const { top, bottom } = useSafeAreaInsets();
  const scroll = useCoachScroll();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        {...scroll}
        style={{ flex: 1, backgroundColor: c.bg }}
        contentContainerStyle={p.fab ? { paddingBottom: bottom + sp.clear } : undefined}
        refreshControl={<RefreshControl refreshing={p.busy && !p.loading} onRefresh={p.reload} tintColor={c.primary} />}
      >
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: e.s }}>{p.emoji}</Text>
            {p.onGear && (
              <CoachTarget id={p.gearId ?? 'page:gear'}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={p.gearLabel ?? 'Settings for this tab'}
                  onPress={p.onGear}
                  style={s.chip}
                >
                  <Text style={{ color: c.ink, fontSize: t.body }}>⚙︎ {p.gearLabel ?? 'Edit'}</Text>
                </Pressable>
              </CoachTarget>
            )}
          </View>
          <Text style={{ color: c.ink, fontSize: t.head, fontWeight: '800' }}>{p.title}</Text>
          <Text style={{ color: c.mute, fontSize: t.body }}>{p.line}</Text>
        </View>
        <View style={{ padding: sp.l }}>
          {!!p.err && (
            <>
              <Text style={s.err}>{p.err}</Text>
              <Btn label="Try again" onPress={p.reload} />
            </>
          )}
          {p.loading && !p.err && <ListSkeleton />}
          {!p.loading && p.children}
        </View>
      </ScrollView>
      {p.fab && <Fab label={p.fab.label} onPress={p.fab.onPress} />}
    </View>
  );
}

export const Bar = ({ pct, color }: { pct: number; color: string }) => (
  <View style={{ height: sp.m, borderRadius: r.pill, backgroundColor: c.raised, overflow: 'hidden', marginVertical: sp.s }}>
    <View style={{ height: sp.m, width: `${pct}%`, backgroundColor: color }} />
  </View>
);

export const Chip = ({ label, on, press }: { label: string; on: boolean; press: () => void }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ selected: on }}
    onPress={press}
    style={{
      paddingVertical: sp.m,
      paddingHorizontal: sp.l,
      borderRadius: r.pill,
      marginRight: sp.s,
      marginBottom: sp.s,
      backgroundColor: on ? c.primary : c.raised,
      borderWidth: 1,
      borderColor: on ? c.primary : c.line,
    }}
  >
    <Text style={{ color: on ? c.onPrimary : c.ink, fontSize: t.body, fontWeight: on ? '700' : '400' }}>{label}</Text>
  </Pressable>
);

const TYPES: [ActivityFilter['type'], string][] = [
  ['all', 'Everything'],
  ['expense', 'Spent'],
  ['income', 'Earned'],
  ['transfer', 'Moved'],
];

export function Activity({ snap, onPick, onAdd, ver }: { snap: Snapshot; onPick: (t: Tx) => void; onAdd: () => void; ver: number }) {
  const l = useList(loadActivity, [ver]);
  const [f, setF] = useState<ActivityFilter>({ type: 'all', accountId: '' });
  const [open, setOpen] = useState(false);
  const acc = (id: string | null) => snap.accounts.find((a) => a.id === id)?.name ?? '';
  const cat = (id: string | null) => snap.categories.find((x) => x.id === id)?.name ?? '';
  const rows = l.rows ? filterActivity(l.rows, f) : [];
  const filtered = f.type !== 'all' || f.accountId !== '';
  return (
    <>
      <Page
        emoji="🧾"
        title="Activity"
        line={filtered ? `${rows.length} matching of your latest 200.` : 'Your latest 200 entries.'}
        tint={c.hero.navy}
        loading={l.rows === null}
        onGear={() => setOpen(true)}
        gearLabel={filtered ? 'Filter on' : 'Filter'}
        gearId="activity:filter"
        fab={{ label: '＋ Add entry', onPress: onAdd }}
        {...l}
      >
        {rows.length > 0 && <Text style={[s.p, { marginBottom: sp.s }]}>Tap an entry to edit or delete it.</Text>}
        {rows.length === 0 && (
          <CoachTarget id="activity:rows" empty>
            <Text style={s.p}>
              {filtered ? 'Nothing matches this filter. Open Filter to change it.' : 'Nothing yet. Tap Add entry to log your first one.'}
            </Text>
          </CoachTarget>
        )}
        {rows.map((x, i) => (
          <CoachTarget key={x.id} id="activity:rows" on={i === 0}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit ${x.description || cat(x.category_id) || 'transfer'}`}
              onPress={() => onPick(x)}
              style={[s.card, { flexDirection: 'row', justifyContent: 'space-between', marginBottom: sp.s }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.ink, fontWeight: '700', fontSize: t.body }}>
                  {x.description || cat(x.category_id) || 'Transfer'}
                </Text>
                <Text style={{ color: c.mute, fontSize: t.caption }}>
                  {x.transaction_date} · {cat(x.category_id) || 'Transfer'} · {acc(x.account_id)}
                </Text>
              </View>
              <Text
                style={{ color: x.type === 'income' ? c.up : x.type === 'expense' ? c.down : c.mute, fontWeight: '800', fontSize: t.body }}
              >
                {sign(x.type)}
                {formatMinor(x.amount_minor)}
              </Text>
              <Text style={{ color: c.mute, fontSize: t.title, marginLeft: sp.s }}>›</Text>
            </Pressable>
          </CoachTarget>
        ))}
      </Page>
      <Sheet open={open} title="Filter activity" onClose={() => setOpen(false)}>
        <Text style={s.p}>Show</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: sp.s }}>
          {TYPES.map(([id, label]) => (
            <Chip key={id} label={label} on={f.type === id} press={() => setF({ ...f, type: id })} />
          ))}
        </View>
        <Text style={s.p}>From account</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: sp.s }}>
          <Chip label="All accounts" on={f.accountId === ''} press={() => setF({ ...f, accountId: '' })} />
          {snap.accounts.map((a) => (
            <Chip key={a.id} label={a.name} on={f.accountId === a.id} press={() => setF({ ...f, accountId: a.id })} />
          ))}
        </View>
      </Sheet>
    </>
  );
}

export function TabBar({ tab, setTab, onHeight }: { tab: string; setTab: (t: string) => void; onHeight?: (h: number) => void }) {
  const { bottom } = useSafeAreaInsets();
  const items = [
    ['home', '🏠', 'Home'],
    ['activity', '🧾', 'Activity'],
    ['accounts', '👛', 'Accounts'],
    ['budgets', '🎯', 'Budgets'],
    ['goals', '🏆', 'Goals'],
    ['more', '⚙️', 'Settings'],
  ];
  return (
    <View
      onLayout={(e) => onHeight?.(e.nativeEvent.layout.height)}
      style={{
        flexDirection: 'row',
        backgroundColor: c.card,
        borderTopWidth: 1,
        borderTopColor: c.line,
        paddingBottom: bottom + sp.s,
        paddingTop: sp.s,
      }}
    >
      {items.map(([id, em, label]) => (
        <CoachTarget key={id} id={`tab:${id}`} style={{ flex: 1 }}>
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: tab === id }}
            onPress={() => setTab(id)}
            style={{ alignItems: 'center', paddingVertical: sp.s }}
          >
            <Text style={{ fontSize: t.title, opacity: tab === id ? 1 : 0.55 }}>{em}</Text>
            <Text
              style={{ fontSize: t.caption, fontWeight: tab === id ? '800' : '500', color: tab === id ? c.primary : c.mute }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {label}
            </Text>
          </Pressable>
        </CoachTarget>
      ))}
    </View>
  );
}
