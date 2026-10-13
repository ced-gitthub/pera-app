import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Text, View } from 'react-native';
import type { Gate as GateResult } from '../../src/lib/onboarding';
import { supabase } from './supabase';
import { load, type Snapshot } from './data';
import { loadCounts } from './wizardData';
import { readFlags, setFlags } from './flags';
import { type Tx, decideGate, firstName, FINISH_FLAGS, REPLAY_FLAGS } from './logic';
import { Home } from './Home';
import { EntrySheet, UndoBar } from './EntrySheet';
import { restoreEntry } from './entries';
import { afterRestore, type UndoState } from './entriesLogic';
import { runDue } from './recurringApi';
import { shouldRunDue } from './recurringLogic';
import { manilaToday } from '../../src/core/money';
import { Activity, TabBar } from './Tabs';
import { Budgets, Goals } from './Planning';
import { Settings } from './Settings';
import { HomeSkeleton } from './Skeleton';
import { Wizard } from './Wizard';
import { Btn } from './Btn';
import { c, s, sp, t } from './ui';

// Decides between the wizard and Home from REAL data (entries, opening balances, budgets, goals). Flags only remember what was seen, per account.
// If the counts cannot be read the person is let in (fail open) and nothing is blocked by a read error.
export function Gate() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [gate, setGate] = useState<GateResult | null>(null);
  const [uid, setUid] = useState('');
  const [name, setName] = useState('');
  const [tab, setTab] = useState('home');
  const [picked, setPicked] = useState<Tx | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [tabH, setTabH] = useState(0);
  const [notice, setNotice] = useState('');
  const lastTry = useRef<number | null>(null);
  const lastDue = useRef<string | null>(null); // Manila day when due recurring rules last ran; they run again when the day changes, like the website does on each Home load
  const [ver, setVer] = useState(0); // bumps when an entry changes, so lists reload
  const [err, setErr] = useState('');
  // Returns '' on success, or the message to show. A failed re-read is shown, never hidden.
  const refresh = useCallback(async (): Promise<string> => {
    try {
      const { data } = await supabase.auth.getSession();
      const id = data.session?.user.id;
      if (!id) return 'Session expired. Please sign in again.';
      const sn = await load();
      const flags = await readFlags(id);
      const counts = await loadCounts().catch(() => null);
      const d = decideGate(counts, sn.accounts, flags);
      await setFlags(id, d.set);
      setUid(id);
      const prof = await supabase.from('profiles').select('name').eq('id', id).maybeSingle();
      const nm = String(prof.data?.name || data.session?.user.user_metadata?.name || data.session?.user.email?.split('@')[0] || '');
      setName(nm);
      setSnap(sn);
      setGate(d.gate);
      setErr('');
      // Due recurring rules run AFTER the screen has its data, so a slow network never stalls a refresh. If they made entries, reload once.
      if (shouldRunDue(lastDue.current, manilaToday(), lastTry.current)) {
        lastTry.current = Date.now();
        void runDue()
          .catch(() => ({ created: 0, error: 'Could not run your recurring entries right now.' }))
          .then(async (r) => {
            setNotice(r.error ?? '');
            if (!r.error) lastDue.current = manilaToday();
            if (r.created > 0) await refresh();
          });
      }
      return '';
    } catch (e) {
      const m = (e as Error).message || 'Could not load your data. Check your connection.';
      setErr(m);
      return m;
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    // coming back to the app on a new day runs the day's recurring entries and reloads the numbers
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active' && shouldRunDue(lastDue.current, manilaToday())) void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  if (!snap || !gate)
    return err ? (
      <View style={s.screen}>
        <Text style={s.err}>{err}</Text>
        <Btn label="Try again" onPress={refresh} />
      </View>
    ) : (
      <HomeSkeleton />
    );
  if (gate.show)
    return (
      <Wizard
        key={gate.step}
        slide={gate.step === 'tour' ? 'first' : gate.step}
        doneIds={gate.doneIds}
        snap={snap}
        tour={gate.step === 'tour'}
        refresh={refresh}
        onBalances={() => setFlags(uid, { balances: true })}
        onFinish={async () => {
          await setFlags(uid, FINISH_FLAGS);
          await refresh();
        }}
      />
    );
  const replay = async () => {
    await setFlags(uid, REPLAY_FLAGS);
    setTab('home');
    await refresh();
  };
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {tab === 'home' && <Home snap={snap} refresh={refresh} name={firstName(name)} onPick={setPicked} />}
        {tab === 'activity' && <Activity snap={snap} onPick={setPicked} ver={ver} />}
        {tab === 'budgets' && <Budgets snap={snap} />}
        {tab === 'goals' && <Goals snap={snap} />}
        {tab === 'more' && <Settings snap={snap} name={name} refresh={refresh} onReplay={replay} />}
      </View>
      <UndoBar
        row={undo?.row ?? null}
        error={undo?.error}
        lift={tabH}
        onDismiss={() => setUndo(null)}
        onUndo={async () => {
          if (!undo) return;
          const m = await restoreEntry(undo.row);
          const next = afterRestore(undo, m);
          setUndo(next);
          if (!next) {
            setVer((v) => v + 1);
            await refresh();
          }
        }}
      />
      <EntrySheet
        tx={picked}
        snap={snap}
        onClose={() => setPicked(null)}
        onChanged={async (u) => {
          setUndo(u ?? null);
          setVer((v) => v + 1);
          await refresh();
        }}
      />
      {!!notice && <Text style={{ color: c.mute, fontSize: t.caption, textAlign: 'center', padding: sp.s }}>{notice}</Text>}
      <TabBar tab={tab} setTab={setTab} onHeight={setTabH} />
    </View>
  );
}
