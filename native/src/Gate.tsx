import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Text, View } from 'react-native';
import type { Gate as GateResult } from '../../src/lib/onboarding';
import { supabase } from './supabase';
import { load, type Snapshot } from './data';
import { loadCounts } from './wizardData';
import { readFlags, setFlags, tabTourSeen, markTabTourSeen } from './flags';
import { TabTour } from './TabTour';
import { CoachProvider } from './Coach';
import { TOUR } from './tourContent';
import { type Tx, decideGate, firstName, FINISH_FLAGS, REPLAY_FLAGS } from './logic';
import { Home } from './Home';
import { EntrySheet, UndoBar } from './EntrySheet';
import { restoreEntry } from './entries';
import { afterRestore, type UndoState } from './entriesLogic';
import { runDue } from './recurringApi';
import { takeSignUpFlag } from './fresh';
import { shouldAskAboutExistingData } from './freshLogic';
import { ExistingDataPrompt } from './ExistingDataPrompt';
import { ResetData } from './ResetData';
import { MakeItYours } from './MakeItYours';
import { makeItYoursSeen } from './profile';
import { shouldRunDue } from './recurringLogic';
import { manilaToday } from '../../src/core/money';
import { Activity, TabBar } from './Tabs';
import { Budgets, Goals } from './Planning';
import { Settings } from './Settings';
import { AccountsTab } from './AccountsTab';
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
  const [creating, setCreating] = useState(false); // the manual "New entry" form from Activity
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [tabH, setTabH] = useState(0);
  const [notice, setNotice] = useState('');
  const [ask, setAsk] = useState(false); // sign-up landed in an account that already has data: ask, never delete silently
  const [fresh, setFresh] = useState(false);
  const [mine, setMine] = useState(false); // 'Make it yours' (theme + profile), once per account
  const [tour, setTour] = useState<number | null>(null); // index of the live-tour step, or null when it is closed
  const tourFrom = useRef('home'); // the tab the person was on, restored when the tour ends
  const lastTry = useRef<number | null>(null);
  const lastDue = useRef<string | null>(null); // Manila day when due recurring rules last ran; they run again when the day changes, like the website does on each Home load
  const [ver, setVer] = useState(0); // bumps when an entry changes, so lists reload
  const [err, setErr] = useState('');
  const startTour = (from: string) => {
    tourFrom.current = from;
    setTour(0);
  };
  useEffect(() => {
    // every tour step shows its own real tab underneath the overlay
    if (tour !== null) setTab(TOUR[Math.min(tour, TOUR.length - 1)].tab);
  }, [tour]);
  // Returns '' on success, or the message to show. A failed re-read is shown, never hidden.
  const refresh = useCallback(async (): Promise<string> => {
    try {
      const { data } = await supabase.auth.getSession();
      const id = data.session?.user.id;
      if (!id) return 'Session expired. Please sign in again.';
      const wasSignUp = await takeSignUpFlag(); // read once; used below with this load's counts
      const sn = await load();
      const flags = await readFlags(id);
      const counts = await loadCounts().catch(() => null);
      const d = decideGate(counts, sn.accounts, flags);
      await setFlags(id, d.set);
      if (shouldAskAboutExistingData(wasSignUp, counts)) setAsk(true);
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
    if (!uid) return;
    void makeItYoursSeen(uid).then((seen) => !seen && setMine(true));
  }, [uid]);
  useEffect(() => {
    // the tab tour opens once per account, as soon as the first-run steps are out of the way
    if (!snap || !gate || gate.show || !uid) return;
    void tabTourSeen(uid).then((seen) => {
      if (!seen) {
        startTour('home');
        void markTabTourSeen(uid);
      }
    });
  }, [snap, gate, uid]);
  useEffect(() => {
    // coming back to the app on a new day runs the day's recurring entries and reloads the numbers
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active' && shouldRunDue(lastDue.current, manilaToday())) void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  if (mine) return <MakeItYours open onDone={() => setMine(false)} />;
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
  const endTour = () => {
    setTour(null);
    setTab(tourFrom.current);
  };
  const replay = async () => {
    await setFlags(uid, REPLAY_FLAGS);
    setTab('home');
    await refresh();
  };
  return (
    <CoachProvider>
      <View style={{ flex: 1 }}>
        {/* while the tour is open, screen readers (TalkBack) must not reach the controls under the dim layer */}
        <View
          style={{ flex: 1 }}
          importantForAccessibility={tour !== null ? 'no-hide-descendants' : 'auto'}
          accessibilityElementsHidden={tour !== null}
        >
          {tab === 'home' && (
            <Home snap={snap} refresh={refresh} name={firstName(name)} onPick={setPicked} onOpenAccounts={() => setTab('accounts')} />
          )}
          {tab === 'activity' && <Activity snap={snap} onPick={setPicked} onAdd={() => setCreating(true)} ver={ver} />}
          {tab === 'accounts' && <AccountsTab snap={snap} refresh={refresh} />}
          {tab === 'budgets' && <Budgets snap={snap} />}
          {tab === 'goals' && <Goals snap={snap} />}
          {tab === 'more' && <Settings snap={snap} name={name} refresh={refresh} onReplay={replay} onTour={() => startTour(tab)} />}
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
          creating={creating}
          snap={snap}
          onClose={() => {
            setPicked(null);
            setCreating(false);
          }}
          onChanged={async (u) => {
            setUndo(u ?? null);
            setVer((v) => v + 1);
            await refresh();
          }}
        />
        {!!notice && <Text style={{ color: c.mute, fontSize: t.caption, textAlign: 'center', padding: sp.s }}>{notice}</Text>}
        <TabBar tab={tab} setTab={setTab} onHeight={setTabH} />
        {tour !== null && <TabTour index={tour} onIndex={setTour} onClose={endTour} />}
      </View>
    </CoachProvider>
  );
}
