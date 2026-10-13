import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { Gate as GateResult } from '../../src/lib/onboarding';
import { supabase } from './supabase';
import { load, type Snapshot } from './data';
import { loadCounts } from './wizardData';
import { readFlags, setFlags } from './flags';
import { decideGate, FINISH_FLAGS, REPLAY_FLAGS } from './logic';
import { Home } from './Home';
import { Wizard } from './Wizard';
import { Btn } from './Btn';
import { s } from './ui';

// Decides between the wizard and Home from REAL data (entries, opening balances, budgets, goals). Flags only remember what was seen, per account.
// If the counts cannot be read the person is let in (fail open) and nothing is blocked by a read error.
export function Gate() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [gate, setGate] = useState<GateResult | null>(null);
  const [uid, setUid] = useState('');
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
    return (
      <View style={s.screen}>
        <Text style={s.p}>{err || 'Loading...'}</Text>
        {!!err && <Btn label="Try again" onPress={refresh} />}
      </View>
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
  return (
    <Home
      snap={snap}
      refresh={refresh}
      onReplay={async () => {
        await setFlags(uid, REPLAY_FLAGS);
        await refresh();
      }}
    />
  );
}
