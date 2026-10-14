import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler } from 'react-native';
import { Text, View } from 'react-native';
import type { Gate as GateResult } from '../../src/lib/onboarding';
import { supabase } from './supabase';
import { load, type Snapshot } from './data';
import { loadCounts } from './wizardData';
import { askPending, readFlags, setAskPending, setFlags, tabTourSeen, markTabTourSeen, samplePending, setSamplePending } from './flags';
import { createGeneration, decideAsk, isReturningAccount, openSheet } from './gateFlow';
import { TabTour } from './TabTour';
import { CoachProvider } from './Coach';
import { TOUR } from './tourContent';
import { type Tx, decideGate, firstName, FINISH_FLAGS } from './logic';
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
import { applyPendingAppIcon } from './appIconApi';
import { ICON_LEAVE_DELAY_MS } from './appIcon';
import { externalOpen, noteActive, noteBackground } from './externalActivity';
import { createLeaveWatcher } from './leaveWatcher';
import { createGateMemo } from './gateMemo';
import { startSamplesWith } from './sampleCore';
import { canOfferSample } from './sampleLogic';
import { MakeItYours } from './MakeItYours';
import { makeItYoursSeen, markMakeItYoursSeen } from './profile';
import { shouldRunDue } from './recurringLogic';
import { manilaToday } from '../../src/core/money';
import { Activity, TabBar } from './Tabs';
import { Budgets, Goals } from './Planning';
import { Settings } from './Settings';
import { AccountsTab } from './AccountsTab';
import { HomeSkeleton, TabBarSkeleton } from './Skeleton';
import { Wizard } from './Wizard';
import { Btn } from './Btn';
import { c, s, sp, t } from './ui';

type Kept = { snap: Snapshot; gate: GateResult; uid: string; name: string; tab: string };
export const gateMemo = createGateMemo<Kept>();
const reloads = createGeneration(); // module level: a remounted Gate (theme redraw) makes the old instance's reload stale

// Decides between the wizard and Home from REAL data (entries, opening balances, budgets, goals). Flags only remember what was seen, per account.
// If the counts cannot be read the person is let in (fail open) and nothing is blocked by a read error.
export function Gate({ uid: sessionUid }: { uid: string }) {
  const kept0 = gateMemo.get();
  const kept = kept0 && kept0.uid === sessionUid ? kept0 : null; // never start from another account's data
  const [snap, setSnap] = useState<Snapshot | null>(kept?.snap ?? null);
  const [gate, setGate] = useState<GateResult | null>(kept?.gate ?? null);
  const [uid, setUid] = useState(kept?.uid ?? '');
  const [name, setName] = useState(kept?.name ?? '');
  const [tab, setTab] = useState(kept?.tab ?? 'home');
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
  const [replaying, setReplaying] = useState(false); // the read-only walkthrough (Settings > Show the first-run tutorial again); never the required setup
  const askAnswered = useRef(false); // Keep / Start fresh was chosen: a reload that was already running must not raise the question again
  const freshOpen = useRef(false); // true while the Start fresh sheet is open (read inside the reload)
  const booted = useRef(false); // the first load also decides Make it yours, the pending questions and the tour-seen flag, in one go (no flashing)
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
    freshOpen.current = fresh;
  }, [fresh]);
  useEffect(() => {
    const m = gateMemo.get();
    if (m && m.uid === sessionUid && m.tab !== tab) gateMemo.set({ ...m, tab });
  }, [tab]);
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
      const my = reloads.next();
      const memoToken = gateMemo.begin();
      const wasSignUp = await takeSignUpFlag(data.session?.user.email ?? ''); // read once; used below with this load's counts
      if (wasSignUp) await setAskPending(id, true); // saved BEFORE the network reads: a failed or replaced load can no longer lose the question
      // One round trip, not four in a row: the snapshot, the counts and the profile are read together.
      const [sn, flags, counts, prof, seenMine, pendingSamples, tourSeen, pendingAsk] = await Promise.all([
        load(),
        readFlags(id),
        loadCounts().catch(() => null),
        Promise.resolve(supabase.from('profiles').select('name').eq('id', id).maybeSingle()).catch(() => ({ data: null })),
        makeItYoursSeen(id),
        samplePending(id),
        tabTourSeen(id),
        askPending(id),
      ]);
      if (reloads.isStale(my)) return ''; // a newer reload started while this one was waiting: it will apply its own answer
      let d = decideGate(counts, sn.accounts, flags);
      // A reinstall wipes the phone's "seen" markers: an account that is already set up is a returning user, not a new one.
      const returning = isReturningAccount({
        wasSignUp,
        replaying: false,
        firstLoad: !booted.current,
        accountsCount: sn.accounts.length,
        hasActivity: !!counts && counts.totalEntries + counts.budgetsCount + counts.goalsCount > 0,
        gate: d.gate,
      });
      if (returning) {
        await Promise.all([markTabTourSeen(id), markMakeItYoursSeen(id)]);
        d = { gate: { show: false, mark: false }, set: { onboarded: true, toured: true, wizard: false } };
      }
      await setFlags(id, d.set);
      const dec = decideAsk({
        wasSignUp,
        pending: pendingAsk,
        fresh: freshOpen.current,
        answered: askAnswered.current,
        total: counts ? counts.totalEntries + counts.budgetsCount + counts.goalsCount : null,
      });
      if (dec.write === 'clear') void setAskPending(id, false); // the account is known to be empty: nothing to ask
      if (dec.ask) setAsk(true);
      if (!booted.current) {
        booted.current = true;
        setMine(!seenMine && !returning);
        setSampleEnd(pendingSamples && tourSeen); // if the tour was not seen yet, the tour choice comes first and the Keep / Clear question follows the tour
      }
      setCanSample(canOfferSample(counts, sn.accounts.length));
      setUid(id);
      const nm = String(prof.data?.name || data.session?.user.user_metadata?.name || data.session?.user.email?.split('@')[0] || '');
      setName(nm);
      setSnap(sn);
      setGate(d.gate);
      gateMemo.set({ snap: sn, gate: d.gate, uid: id, name: nm, tab: gateMemo.get()?.tab ?? 'home' }, memoToken);
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
    // the tab tour opens once per account, as soon as the first-run steps are out of the way
    if (!snap || !gate || gate.show || !uid || ask || fresh) return; // the tour waits while the existing-data question is open
    void tabTourSeen(uid).then((seen) => {
      if (!seen) setChoose(true); // marked as seen only when answered (onChoose)
    });
  }, [snap, gate, uid, ask, fresh]);
  useEffect(() => {
    // a queued launcher-icon change is applied when the person LEAVES the app (Android closes the app to switch icons, so never while it is in use)
    const watcher = createLeaveWatcher({
      delayMs: ICON_LEAVE_DELAY_MS,
      getState: () => AppState.currentState,
      externalOpen,
      apply: () => void applyPendingAppIcon(),
      noteBackground,
      noteActive,
      setTimer: (f, ms) => setTimeout(f, ms),
      clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    });
    const sub = AppState.addEventListener('change', (st) => watcher.onChange(st));
    return () => {
      watcher.dispose();
      sub.remove();
    };
  }, []);
  useEffect(() => {
    // the read-only walkthrough: the back button leaves it
    if (!replaying) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setReplaying(false);
      return true;
    });
    return () => sub.remove();
  }, [replaying]);
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
      <View style={{ flex: 1 }}>
        <HomeSkeleton />
        <TabBarSkeleton />
      </View>
    );
  const startSamples = () =>
    startSamplesWith({ setPending: (on) => setSamplePending(uid, on), add: () => addSamples(snap), remove: removeSamples });
  const sheet = openSheet({ ask: ask && !mine, fresh, choose, end: sampleEnd, tour: tour !== null, mine });
  const keepExisting = () => {
    askAnswered.current = true;
    setAsk(false);
    void setAskPending(uid, false);
  };
  const startFresh = () => {
    askAnswered.current = true;
    setAsk(false);
    setFresh(true);
  };
  const resetSheet = (
    <ResetData
      open={sheet === 'fresh'}
      onClose={() => (setFresh(false), void setAskPending(uid, false))}
      onDone={() => {
        void setAskPending(uid, false); // the account is empty now: the question must not come back after a restart
        void refresh();
      }}
    />
  );
  if (replaying)
    return (
      <Wizard
        key="replay"
        slide="first"
        doneIds={[]}
        snap={snap}
        tour
        refresh={refresh}
        onBalances={async () => true}
        onFinish={() => setReplaying(false)}
        onClose={() => setReplaying(false)}
      />
    );
  if (gate.show)
    return (
      <>
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
        <ExistingDataPrompt open={sheet === 'ask'} onKeep={keepExisting} onFresh={startFresh} />
        {resetSheet}
      </>
    );
  const endTour = () => {
    setTour(null);
    setTab(tourFrom.current);
    void samplePending(uid).then((on) => on && setSampleEnd(true));
  };
  const onChoose = async (k: 'sample' | 'plain' | 'skip') => {
    void markTabTourSeen(uid); // answered: the offer is used up (closing the app at the sheet keeps it)
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
  const replay = () => {
    setTab('home');
    setReplaying(true); // read-only walkthrough: no flags change, the required setup is never re-opened
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
        <ExistingDataPrompt open={sheet === 'ask'} onKeep={keepExisting} onFresh={startFresh} />
        <TourChoice open={sheet === 'choose'} canSample={canSample} onChoose={onChoose} />
        <TourEnd
          open={sheet === 'end'}
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
            await refresh(); // the app is now empty; the first-run tutorial is NOT shown again (it is only a first-run step)
            return null;
          }}
        />
        {resetSheet}
        {!!notice && <Text style={{ color: c.mute, fontSize: t.caption, textAlign: 'center', padding: sp.s }}>{notice}</Text>}
        <TabBar tab={tab} setTab={setTab} onHeight={setTabH} />
        {tour !== null && <TabTour index={tour} onIndex={setTour} onClose={endTour} />}
      </View>
    </CoachProvider>
  );
}
