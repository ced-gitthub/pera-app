import { useCallback, useEffect, useRef, useState } from 'react';
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
import { runDue } from './recurringApi';
import { Activity, TabBar } from './Tabs';
import { Budgets, Goals } from './Planning';
import { Settings } from './Settings';
import { HomeSkeleton } from './Skeleton';
import { Wizard } from './Wizard';
import { Btn } from './Btn';
import { s } from './ui';

// Decides between the wizard and Home from REAL data (entries, opening balances, budgets, goals). Flags only remember what was seen, per account.
// If the counts cannot be read the person is let in (fail open) and nothing is blocked by a read error.
export function Gate() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [gate, setGate] = useState<GateResult | null>(null);
  const [uid, setUid] = useState('');
  const [name, setName] = useState('');
  const [tab, setTab] = useState('home');
  const [picked, setPicked] = useState<Tx | null>(null);
  const [undo, setUndo] = useState<{ row: Record<string, unknown> } | null>(null);
  const ranDue = useRef(false); // due recurring rules run once per app start, like the website does on each Home load
  const [ver, setVer] = useState(0); // bumps when an entry changes, so lists reload
  const [err, setErr] = useState('');
  // Returns '' on success, or the message to show. A failed re-read is shown, never hidden.
  const refresh = useCallback(async (): Promise<string> => {
    try {
      const { data } = await supabase.auth.getSession();
      const id = data.session?.user.id;
      if (!id) return 'Session expired. Please sign in again.';
      if (!ranDue.current) {
        ranDue.current = true;
        await runDue().catch(() => null);
      }
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
        onDismiss={() => setUndo(null)}
        onUndo={async () => {
          if (!undo) return;
          const m = await restoreEntry(undo.row);
          if (m) return setErr(m);
          setUndo(null);
          setVer((v) => v + 1);
          await refresh();
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
      <TabBar tab={tab} setTab={setTab} />
    </View>
  );
}
