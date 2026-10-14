import { useState } from 'react';
import { Text } from 'react-native';
import { Sheet } from './Sheet';
import { Btn } from './Btn';
import { countFor } from './reset';
import { RESET_KINDS, resetWarning, type Counts } from './resetLogic';
import { TOUR_END_CLEAR, TOUR_END_CONFIRM, TOUR_END_KEEP, TOUR_END_TEXT, TOUR_END_TITLE } from './sampleLogic';
import { s, sp } from './ui';

// Asked once, before the first tour. The sample entries are optional, labelled "Sample:", and the next sheet lets the person keep or clear them.
export function TourChoice({
  open,
  canSample,
  onChoose,
}: {
  open: boolean;
  canSample: boolean;
  onChoose: (c: 'sample' | 'plain' | 'skip') => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const pick = async (k: 'sample' | 'plain' | 'skip') => {
    if (busy) return;
    setBusy(true);
    try {
      await onChoose(k);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} title="Take a quick tour?" onClose={() => void pick('skip')}>
      <Text style={[s.p, { marginBottom: sp.l }]}>
        {canSample
          ? 'I can fill your app with a few sample entries, so every screen has something to show instead of you typing them in. Each one starts with "Sample:". When the tour ends you choose to keep them or clear them.'
          : 'The tour walks through each tab using your own data.'}
      </Text>
      {canSample && <Btn label="Tour with sample entries" busy={busy} onPress={() => void pick('sample')} />}
      <Btn label={canSample ? 'Tour without sample entries' : 'Start the tour'} alt busy={busy} onPress={() => void pick('plain')} />
      <Btn label="Not now" alt busy={busy} onPress={() => void pick('skip')} />
    </Sheet>
  );
}

// Asked when the tour ends (or on the next launch if the app was closed mid-tour). Clear means ALL of it: a second step lists exactly what goes.
export function TourEnd({
  open,
  onKeep,
  onClear,
}: {
  open: boolean;
  onKeep: () => Promise<void> | void;
  onClear: () => Promise<string | null>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [counts, setCounts] = useState<Counts | null>(null); // set while the confirm step is showing
  const [counting, setCounting] = useState(false);
  const keep = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onKeep();
    } finally {
      setBusy(false);
    }
  };
  const review = async () => {
    if (busy || counting) return;
    setCounting(true);
    setErr('');
    const list = await Promise.all(RESET_KINDS.map((k) => countFor(k).catch(() => null)));
    setCounting(false);
    if (list.some((n) => n === null)) return setErr('Could not count what would be deleted. Check your connection and try again. Nothing was deleted.');
    setCounts({ entries: list[0], budgets: list[1], goals: list[2], recurring: list[3] });
  };
  const clear = async () => {
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      const m = await onClear();
      if (m) setErr(m);
      else setCounts(null);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} title={TOUR_END_TITLE} onClose={() => (counts ? setCounts(null) : void keep())}>
      {!counts ? (
        <>
          <Text style={[s.p, { marginBottom: sp.l }]}>{TOUR_END_TEXT}</Text>
          {!!err && <Text style={s.err}>{err}</Text>}
          <Btn label={TOUR_END_KEEP} busy={busy} onPress={() => void keep()} />
          <Btn label={TOUR_END_CLEAR} alt danger busy={counting} onPress={() => void review()} />
        </>
      ) : (
        <>
          <Text style={[s.p, { marginBottom: sp.l }]}>{resetWarning('all', counts)}</Text>
          {!!err && <Text style={s.err}>{err}</Text>}
          <Btn label={TOUR_END_CONFIRM} danger busy={busy} onPress={() => void clear()} />
          <Btn label="Go back" alt onPress={() => setCounts(null)} />
        </>
      )}
    </Sheet>
  );
}
