import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatMinor, manilaToday } from '../../src/core/money';
import { Btn } from './Btn';
import type { Snapshot } from './logic';
import { loadMonthSummary, loadYearMonths } from './reportsApi';
import { barHeights, canGoNext, monthLabel, shiftMonth, summarize, yearSeries, type MonthRow, type SummaryRow } from './reportsLogic';
import { Sheet } from './Sheet';
import { ListSkeleton } from './Skeleton';
import { Bar } from './Tabs';
import { c, s, sp, t } from './ui';

const LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const CHART_H = 96;
const ymOf = (year: string, month: number) => `${year}-${String(month).padStart(2, '0')}`;

type Loaded = { ym: string; rows: SummaryRow[]; months: MonthRow[] };

// Loads one month plus its year. A newer request always wins, so tapping the arrows quickly never shows an older month's numbers.
function useReport(ym: string) {
  const [data, setData] = useState<Loaded | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(true);
  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setBusy(true);
    setErr('');
    try {
      const [rows, months] = await Promise.all([loadMonthSummary(ym), loadYearMonths(Number(ym.slice(0, 4)))]);
      if (mine === seq.current) setData({ ym, rows, months });
    } catch (x) {
      if (mine === seq.current) setErr((x as Error).message);
    }
    if (mine === seq.current) setBusy(false);
  }, [ym]);
  useEffect(() => {
    load();
  }, [load]);
  return { data: data && data.ym === ym ? data : null, err, busy, retry: load };
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ flex: 1 }} accessible accessibilityLabel={`${label} ${formatMinor(value)}`}>
      <Text style={s.p}>{label}</Text>
      <Text style={{ color, fontSize: t.lead, fontWeight: '800' }} numberOfLines={1} adjustsFontSizeToFit>
        {formatMinor(value)}
      </Text>
    </View>
  );
}

function Arrow({ label, glyph, off, onPress }: { label: string; glyph: string; off: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off }}
      disabled={off}
      onPress={onPress}
      style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', opacity: off ? 0.3 : 1 }}
    >
      <Text style={{ color: c.ink, fontSize: t.title, fontWeight: '800' }}>{glyph}</Text>
    </Pressable>
  );
}

export function Reports({ snap, onClose }: { snap: Snapshot; onClose: () => void }) {
  const today = manilaToday();
  const [ym, setYm] = useState(today.slice(0, 7));
  const { data, err, busy, retry } = useReport(ym);
  const sum = useMemo(() => (data ? summarize(data.rows, snap.categories) : null), [data, snap.categories]);
  const series = useMemo(() => (data ? yearSeries(data.months) : null), [data]);
  const heights = useMemo(() => (series ? barHeights(series) : null), [series]);
  const year = ym.slice(0, 4);
  const yIn = series ? series.reduce((n, p) => n + p.income, 0) : 0;
  const yOut = series ? series.reduce((n, p) => n + p.expense, 0) : 0;

  return (
    <Sheet open title="Reports" onClose={onClose}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: sp.m }}>
        <Arrow label="Previous month" glyph="‹" off={false} onPress={() => setYm(shiftMonth(ym, -1))} />
        <Text accessibilityRole="header" style={{ color: c.ink, fontSize: t.lead, fontWeight: '700' }}>
          {monthLabel(ym)}
        </Text>
        <Arrow label="Next month" glyph="›" off={!canGoNext(ym, today)} onPress={() => setYm(shiftMonth(ym, 1))} />
      </View>

      {err ? (
        <View style={s.card}>
          <Text style={s.err}>{err}</Text>
          <Btn label="Try again" onPress={retry} busy={busy} />
        </View>
      ) : !sum || !series || !heights ? (
        <ListSkeleton rows={4} />
      ) : (
        <>
          <View style={[s.card, { flexDirection: 'row', gap: sp.m }]}>
            <Stat label="Income" value={sum.income} color={c.up} />
            <Stat label="Expenses" value={sum.expense} color={c.down} />
            <Stat label="Net" value={sum.net} color={sum.net < 0 ? c.down : c.up} />
          </View>

          <View style={s.card}>
            <Text style={s.h2}>Spending by category</Text>
            {sum.byCategory.length === 0 ? (
              <Text style={s.p}>{sum.count === 0 ? 'No entries this month' : 'No spending this month'}</Text>
            ) : (
              sum.byCategory.map((x) => (
                <View key={x.id} accessible accessibilityLabel={`${x.name}, ${formatMinor(x.total)}, ${x.pct} percent of spending`}>
                  <View style={s.row}>
                    <Text style={{ color: c.ink, fontSize: t.body, flex: 1 }} numberOfLines={1}>
                      {x.name}
                    </Text>
                    <Text style={{ color: c.ink, fontSize: t.body, fontWeight: '700' }}>{formatMinor(x.total)}</Text>
                  </View>
                  <Bar pct={x.pct} color={c.down} />
                  <Text style={s.p}>{x.pct}%</Text>
                </View>
              ))
            )}
          </View>

          <View style={s.card}>
            <Text style={s.h2}>{year}: income vs expenses</Text>
            <View style={{ flexDirection: 'row', height: CHART_H, alignItems: 'flex-end' }}>
              {series.map((p, i) => (
                <Pressable
                  key={p.month}
                  accessibilityRole="button"
                  accessibilityLabel={`${monthLabel(ymOf(year, p.month))}, income ${formatMinor(p.income)}, expenses ${formatMinor(p.expense)}`}
                  accessibilityState={{ selected: ymOf(year, p.month) === ym }}
                  onPress={() => setYm(ymOf(year, p.month))}
                  style={{ flex: 1, height: CHART_H, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' }}
                >
                  <View style={{ width: sp.s, height: `${heights[i].income}%`, minHeight: p.income > 0 ? 2 : 0, backgroundColor: c.up }} />
                  <View
                    style={{ width: sp.s, height: `${heights[i].expense}%`, minHeight: p.expense > 0 ? 2 : 0, backgroundColor: c.down }}
                  />
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', marginTop: sp.s }}>
              {LETTERS.map((l, i) => {
                const picked = ymOf(year, i + 1) === ym;
                return (
                  <Text
                    key={i}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      fontSize: t.caption,
                      color: picked ? c.reward : c.mute,
                      fontWeight: picked ? '800' : '400',
                    }}
                  >
                    {l}
                  </Text>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: sp.m }}>
              <Text style={{ color: c.up, fontSize: t.caption }}>In {formatMinor(yIn)}</Text>
              <Text style={{ color: c.down, fontSize: t.caption }}>Out {formatMinor(yOut)}</Text>
            </View>
          </View>
        </>
      )}
    </Sheet>
  );
}
