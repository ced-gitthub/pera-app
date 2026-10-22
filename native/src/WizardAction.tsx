import { useState, type ReactElement } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { formatMinor } from '../../src/core/money';
import { minorToInput } from '../../src/lib/common/validate';
import { GOAL_EMOJIS } from '../../src/lib/progress/goals';
import type { GateStep } from '../../src/lib/onboarding/onboarding';
import type { Snapshot } from './data';
import { balancePrefill } from './logic';
import { BALANCE_SAMPLE_NOTE } from './sampleLogic';
import { ToggleRow } from './Sheet';
import { setAccountFlag } from './config';
import { saveBalances, saveBudget, saveGoal } from './wizardData';
import { QuickAdd } from './QuickAdd';
import { Btn } from './Btn';
import { pinnedLabel } from './wizardPinned';
import { c, s, sp, r, TOUCH } from './ui';

// The setup step's form (`body`, scrolls) and its primary action + message line (`footer`, pinned below the ScrollView).
// `step` is null on the finish slide: nothing to render.
export function useWizardAction(
  step: GateStep | null,
  tour: boolean,
  {
    snap,
    refresh,
    onBalances,
    onUseSamples,
  }: {
    snap: Snapshot;
    refresh: () => Promise<string>;
    onBalances: () => Promise<boolean>;
    onUseSamples?: () => Promise<string | null>;
  },
): { body: ReactElement | null; footer: ReactElement | null } {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async (f: () => Promise<string | null>, after?: () => Promise<boolean>) => {
    if (busy) return;
    setBusy(true);
    setErr('');
    const e = await f().catch(() => 'Not saved: could not reach the server. Try again.');
    if (e) setErr(e);
    else if (after && !(await after())) setErr('Saved, but this phone could not remember the step. Try again.');
    else {
      setErr(await refresh()); // the gate re-reads real data and moves to the next slide; a failed re-read is shown, not hidden
    }
    setBusy(false);
  };
  const [bal, setBal] = useState<Record<string, string>>(() =>
    Object.fromEntries(snap.accounts.map((a) => [a.id, minorToInput(balancePrefill(snap, a))])),
  );
  const [flagBusy, setFlagBusy] = useState('');
  const flip = async (id: string, on: boolean) => {
    setFlagBusy(id);
    setErr('');
    const m = await setAccountFlag(id, 'counts_as_savings', on).catch(() => 'Not saved: could not reach the server. Try again.');
    setErr(m ?? (await refresh()));
    setFlagBusy('');
  };
  const [cat, setCat] = useState('');
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(GOAL_EMOJIS[0]);
  const [account, setAccount] = useState('');
  const field = (v: string, set: (x: string) => void, label: string, kb: 'default' | 'decimal-pad' = 'default') => (
    <TextInput
      style={s.input}
      value={v}
      onChangeText={set}
      placeholder={label}
      placeholderTextColor={c.mute}
      accessibilityLabel={label}
      keyboardType={kb}
    />
  );
  const chip = (label: string, on: boolean, press: () => void) => (
    <Pressable
      key={label}
      onPress={press}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        minHeight: TOUCH,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: sp.s,
        paddingHorizontal: sp.m,
        borderRadius: r.m,
        marginRight: sp.s,
        marginBottom: sp.s,
        backgroundColor: on ? c.primary : c.raised,
        borderWidth: 1,
        borderColor: c.line,
      }}
    >
      <Text style={{ color: on ? c.onPrimary : c.ink }}>{label}</Text>
    </Pressable>
  );
  if (!step || tour) return { body: null, footer: null };
  const body = (
    <View style={[s.card, { borderColor: c.primary, borderWidth: 2, marginTop: sp.s }]}>
      <Text style={[s.h2, { color: c.primary }]}>👉 Start here</Text>
      {step === 'first' && <QuickAdd snap={snap} onSaved={refresh} />}
      {step === 'first' && !!onUseSamples && snap.totalEntries === 0 && (
        <>
          <Text style={[s.p, { marginTop: sp.m }]}>
            Or skip typing: I fill in a few labelled sample entries for you. You choose to keep or clear them after the tour.
          </Text>
          <Btn label="Use sample entries instead" alt busy={busy} onPress={() => run(onUseSamples)} />
        </>
      )}
      {step === 'balance' && (
        <>
          {Object.values(snap.sampleMovement ?? {}).some((v) => v !== 0) && <Text style={s.p}>{BALANCE_SAMPLE_NOTE}</Text>}
          {snap.accounts.map((a) => (
            <View key={a.id}>
              <Text style={s.p}>{a.name} (₱)</Text>
              {field(bal[a.id] ?? '', (x) => setBal({ ...bal, [a.id]: x }), `${a.name} balance`, 'decimal-pad')}
              <ToggleRow
                label={`${a.name} is savings`}
                hint="Kept out of what you can spend"
                on={a.counts_as_savings}
                busy={flagBusy === a.id}
                onChange={(v) => flip(a.id, v)}
              />
            </View>
          ))}
          <Text style={s.p}>Now: {formatMinor(Object.values(snap.balances).reduce((a, b) => a + b, 0))}</Text>
        </>
      )}
      {step === 'budget' && (
        <>
          <Text style={s.p}>Spending on</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: sp.s }}>
            {snap.categories.filter((x) => x.type === 'expense').map((x) => chip(x.name, cat === x.id, () => setCat(x.id)))}
          </View>
          {field(amount, setAmount, 'Monthly limit (₱)', 'decimal-pad')}
        </>
      )}
      {step === 'goal' && (
        <>
          {field(name, setName, 'Goal name, e.g. New phone')}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{GOAL_EMOJIS.map((e) => chip(e, emoji === e, () => setEmoji(e)))}</View>
          {field(amount, setAmount, 'How much it costs (₱)', 'decimal-pad')}
          <Text style={s.p}>Connect to an account (optional)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: sp.s }}>
            {snap.accounts.map((a) => chip(a.name, account === a.id, () => setAccount(account === a.id ? '' : a.id)))}
          </View>
        </>
      )}
    </View>
  );
  const label = pinnedLabel(step, tour);
  const footer =
    label || err ? (
      <View style={{ paddingHorizontal: sp.l, paddingTop: sp.s, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.bg }}>
        {!!err && <Text style={s.err}>{err}</Text>}
        {step === 'balance' && label === 'Save balances' && (
          <Btn label="Save balances" busy={busy} onPress={() => run(() => saveBalances(bal), onBalances)} />
        )}
        {step === 'budget' && label === 'Set budget' && (
          <Btn label="Set budget" busy={busy} onPress={() => run(() => saveBudget(cat, amount, snap))} />
        )}
        {step === 'goal' && label === 'Add goal' && (
          <Btn label="Add goal" busy={busy} onPress={() => run(() => saveGoal({ name, emoji, amount, account }, snap))} />
        )}
      </View>
    ) : null;
  return { body, footer };
}
