import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { gateFor, type Gate as GateResult } from '../../src/lib/onboarding';
import { load, type Snapshot } from './data';
import { loadCounts } from './wizardData';
import { readFlags, setFlag, clearFlags, type Flags } from './flags';
import { Home } from './Home';
import { Wizard } from './Wizard';
import { Btn } from './Btn';
import { s } from './ui';

// Decides between the wizard and Home from REAL data (entries, opening balances, budgets, goals). Flags only remember what was seen.
// If the counts cannot be read the person is let in (fail open) and nothing is blocked by a read error.
export function Gate() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [gate, setGate] = useState<GateResult | null>(null);
  const [err, setErr] = useState('');
  const refresh = useCallback(async () => {
    try {
      const sn = await load();
      const flags: Flags = await readFlags();
      let g: GateResult;
      try {
        const n = await loadCounts();
        g = gateFor(
          { ...n, accounts: sn.accounts, streak: 0 },
          { onboarded: flags.onboarded, wizard: flags.wizard, balances: flags.balances, toured: flags.toured },
        );
      } catch {
        g = { show: false, mark: false };
      }
      if (g.show && g.step !== 'tour' && g.step !== 'finish' && !flags.wizard) await setFlag('wizard'); // a required step is on screen: remember it, so the closing slide follows
      setSnap(sn);
      setGate(g);
      setErr('');
    } catch (e) {
      setErr((e as Error).message);
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
        onBalances={() => setFlag('balances')}
        onFinish={async () => {
          await setFlag('onboarded');
          await setFlag('toured');
          await setFlag('wizard', false);
          await refresh();
        }}
      />
    );
  return (
    <Home
      snap={snap}
      refresh={refresh}
      onReplay={async () => {
        await clearFlags();
        await refresh();
      }}
    />
  );
}
