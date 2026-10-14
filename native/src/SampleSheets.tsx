import { useState } from 'react';
import { Text } from 'react-native';
import { Sheet } from './Sheet';
import { Btn } from './Btn';
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

// Asked when the tour ends (or on the next launch if the app was closed mid-tour). Clearing deletes ONLY the entries labelled "Sample:".
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
  const keep = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onKeep();
    } finally {
      setBusy(false);
    }
  };
  const clear = async () => {
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      setErr((await onClear()) ?? '');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} title="Keep the sample entries?" onClose={() => void keep()}>
      <Text style={[s.p, { marginBottom: sp.l }]}>
        The tour added a few entries that start with "Sample:". Keep them to play with, or clear them and begin with an empty app. Clearing removes only
        those sample entries. Anything you added yourself stays.
      </Text>
      {!!err && <Text style={s.err}>{err}</Text>}
      <Btn label="Keep them" busy={busy} onPress={() => void keep()} />
      <Btn label="Clear them and start fresh" alt danger busy={busy} onPress={() => void clear()} />
    </Sheet>
  );
}
