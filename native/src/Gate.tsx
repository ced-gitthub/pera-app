import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Text, View } from 'react-native';
import type { Gate as GateResult } from '../../src/lib/onboarding';
import { supabase } from './supabase';
import { load, type Snapshot } from './data';
import { loadCounts } from './wizardData';
import { readFlags, setFlags, tabTourSeen, markTabTourSeen, samplePending, setSamplePending } from './flags';
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
import { TourChoice, TourEnd } from './SampleSheets';
import { addSamples, removeSamples } from './sampleApi';
import { resetChoice } from './reset';
import { startSamplesWith } from './sampleCore';
import { TOUR_END_RESTART_FAIL, canOfferSample } from './sampleLogic';
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
  const [choose, setChoose] = useState(false); // 'Take a quick tour?' (with or without sample entries)
  const [canSample, setCanSample] = useState(false);
  const [sampleEnd, setSampleEnd] = useState(false); // 'Keep the sample entries?' after the tour
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
      const wasSignUp = await takeSignUpFlag(data.session?.user.email ?? ''); // read once; used below with this load's counts
      // One round trip, not four in a row: the snapshot, the counts and the profile are read together.
      const [sn, flags, counts, prof] = await Promise.all([
        load(),
        readFlags(id),
        loadCounts().catch(() => null),
        Promise.resolve(supabase.from('profiles').select('name').eq('id', id).maybeSingle()).catch(() => ({ data: null })),
      ]);
      const d = decideGate(counts, sn.accounts, flags);
      await setFlags(id, d.set);
      if (shouldAskAboutExistingData(wasSignUp, counts)) setAsk(true);
      setCanSample(canOfferSample(counts, sn.accounts.length));
      setUid(id);
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
    if (!snap || !gate || gate.show || !uid || ask || fresh) return; // the tour waits while the existing-data question is open
    void tabTourSeen(uid).then((seen) => {
      if (!seen) {
        setChoose(true);
        void markTabTourSeen(uid);
      }
    });
  }, [snap, gate, uid, ask, fresh]);
  useEffect(() => {
    // the app was closed during a sample-entry tour: still ask what to do with them
    if (uid) void samplePending(uid).then((on) => on && setSampleEnd(true));
  }, [uid]);
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
  const startSamples = () => startSamplesWith({ setPending: (on) => setSamplePending(uid, on), add: () => addSamples(snap), remove: removeSamples });
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
        onUseSamples={startSamples}
        onFinish={async () => {
          await setFlags(uid, FINISH_FLAGS);
          await refresh();
        }}
      />
    );
  const endTour = () => {
    setTour(null);
    setTab(tourFrom.current);
    void samplePending(uid).then((on) => on && setSampleEnd(true));
  };
  const onChoose = async (k: 'sample' | 'plain' | 'skip') => {
    if (k === 'skip') {
      setChoose(false);
      void samplePending(uid).then((on) => on && setSampleEnd(true)); // samples added in the wizard still get their Keep / Clear question
      return;
    }
    if (k === 'sample') {
      const m = await startSamples();
      if (m) setNotice(m);
      await refresh();
    }
    setChoose(false);
    startTour('home');
  };
  // Returns a message when the flags could not be stored (then the setup steps cannot restart), otherwise null.
  const replay = async (startOver = false): Promise<string | null> => {
    const ok = await setFlags(uid, startOver ? { ...REPLAY_FLAGS, balances: false } : REPLAY_FLAGS); // a fresh start asks for the balances again; a plain replay keeps them
    setTab('home');
    await refresh();
    return ok ? null : TOUR_END_RESTART_FAIL;
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
          {tab === 'more' && <Settings snap={snap} name={name} refresh={refresh} onReplay={() => void replay()} onTour={() => startTour(tab)} />}
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
        <ExistingDataPrompt
          open={ask && !mine && tour === null}
          onKeep={() => setAsk(false)}
          onFresh={() => {
            setAsk(false);
            setFresh(true);
          }}
        />
        <TourChoice open={choose && !ask && !fresh && tour === null} canSample={canSample} onChoose={onChoose} />
        <TourEnd
          open={sampleEnd && tour === null && !choose}
          onKeep={async () => {
            await setSamplePending(uid, false);
            setSampleEnd(false);
          }}
          onClear={async () => {
            const r = await resetChoice('all'); // everything: sample entries, budgets, goals, recurring rules, starting balances
            if (r.error) {
              await refresh(); // part of it may already be gone: show the real state behind the sheet
              return r.error;
            }
            await setSamplePending(uid, false);
            setSampleEnd(false);
            const m = await replay(true); // start over from the first step
            if (m) setNotice(m);
            return null;
          }}
        />
        <ResetData open={fresh} onClose={() => setFresh(false)} onDone={() => void refresh()} />
        {!!notice && <Text style={{ color: c.mute, fontSize: t.caption, textAlign: 'center', padding: sp.s }}>{notice}</Text>}
        <TabBar tab={tab} setTab={setTab} onHeight={setTabH} />
        {tour !== null && <TabTour index={tour} onIndex={setTour} onClose={endTour} />}
      </View>
    </CoachProvider>
  );
}
