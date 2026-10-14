import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { countSamples, removeSamples } from './sampleApi';
import type { Snapshot } from './data';
import { setAccountFlag, saveName } from './config';
import { reloadProfile } from './profile';
import { cleanName } from './logic';
import { Page } from './Tabs';
import { Sheet, ToggleRow } from './Sheet';
import { confirmSignOut } from './signout';
import { Btn } from './Btn';
import { CoachTarget } from './Coach';
import { Reports } from './Reports';
import { Recurring } from './Recurring';
import { Manage } from './Manage';
import { Csv } from './Csv';
import { ResetData } from './ResetData';
import { DeleteAccount } from './DeleteAccount';
import { useToast } from './Toast';
import { Personalize } from './Personalize';
import { PersonalizeCard } from './PersonalizeCard';
import { RECORDS_DELETE } from './deleteAccountLogic';
import { nameDrafts, nameIsDirty, UNSAVED_NAME_LINE } from './settingsDirty';
import { c, s, sp, t } from './ui';

export const APP_VERSION = Constants.expoConfig?.version ?? '';

// Which accounts are savings (they leave "You can spend") and which show as cards on Home. Both are saved on the account itself, so the website agrees.
export function AccountsSheet({
  open,
  onClose,
  snap,
  refresh,
}: {
  open: boolean;
  onClose: () => void;
  snap: Snapshot;
  refresh: () => Promise<string>;
}) {
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const flip = async (id: string, field: 'counts_as_savings' | 'show_on_home', on: boolean) => {
    setBusy(id + field);
    setErr('');
    const m = await setAccountFlag(id, field, on).catch(() => 'Not saved: could not reach the server. Try again.');
    if (m) setErr(m);
    else setErr(await refresh());
    setBusy('');
  };
  return (
    <Sheet open={open} title="Your accounts" onClose={onClose}>
      <Text style={[s.p, { marginBottom: sp.s }]}>
        Savings accounts are kept out of "You can spend". Hidden accounts still count in your total.
      </Text>
      {!!err && <Text style={s.err}>{err}</Text>}
      {snap.accounts.map((a) => (
        <View key={a.id} style={[s.card, { marginBottom: sp.s }]}>
          <Text style={s.h2}>{a.name}</Text>
          <ToggleRow
            label="This is savings"
            hint="Not for everyday spending"
            on={a.counts_as_savings}
            busy={busy === a.id + 'counts_as_savings'}
            onChange={(v) => flip(a.id, 'counts_as_savings', v)}
          />
          <ToggleRow
            label="Show on Home"
            on={a.show_on_home}
            busy={busy === a.id + 'show_on_home'}
            onChange={(v) => flip(a.id, 'show_on_home', v)}
          />
        </View>
      ))}
    </Sheet>
  );
}

export function Settings({
  snap,
  name,
  refresh,
  onReplay,
  onTour,
}: {
  snap: Snapshot;
  name: string;
  refresh: () => Promise<string>;
  onReplay: () => void;
  onTour: () => void;
}) {
  const toast = useToast();
  const [nm, setNm] = useState(() => nameDrafts.get(name) ?? name); // a draft typed before a tab switch comes back
  const lastName = useRef(name);
  useEffect(() => {
    // follow the saved name when it changes elsewhere, but never overwrite what the person is typing
    if (name !== lastName.current) {
      const typing = nm !== lastName.current;
      nameDrafts.clear(lastName.current);
      lastName.current = name;
      if (!typing) setNm(name);
      else nameDrafts.set(name, nm);
    }
  }, [name, nm]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ bad: boolean; t: string } | null>(null);
  const [accounts, setAccounts] = useState(false);
  const [reset, setReset] = useState(false);
  const [delAccount, setDelAccount] = useState(false);
  const [sampleCount, setSampleCount] = useState<number | null>(null);
  const [sampleMsg, setSampleMsg] = useState<{ bad: boolean; t: string } | null>(null);
  const [sampleBusy, setSampleBusy] = useState(false);
  const [sampleChecked, setSampleChecked] = useState(false); // false until the first count finished (so "could not count" never flashes while it is still running)
  const recount = useCallback(
    () =>
      void countSamples().then((n) => {
        setSampleCount(n);
        setSampleChecked(true);
      }),
    [],
  );
  useEffect(() => {
    recount();
  }, [recount, snap.totalEntries]);
  const deleteSamples = () => {
    if (sampleBusy) return;
    Alert.alert(
      'Delete sample records?',
      `This deletes the ${sampleCount} sample ${sampleCount === 1 ? 'entry' : 'entries'} (the ones labelled "Sample:"). Your own entries, budgets and goals stay.`,
      [
        { text: 'Keep them', style: 'cancel' },
        {
          text: 'Delete sample records',
          style: 'destructive',
          onPress: async () => {
            setSampleBusy(true);
            setSampleMsg(null);
            try {
              const m = await removeSamples();
              setSampleMsg(m ? { bad: true, t: m } : { bad: false, t: 'Sample records deleted.' });
              recount();
              if (!m) await refresh();
            } finally {
              setSampleBusy(false);
            }
          },
        },
      ],
    );
  };
  const [personalize, setPersonalize] = useState(false);
  const [pver, setPver] = useState(0);
  const [tool, setTool] = useState<'' | 'reports' | 'recurring' | 'manage' | 'csv'>('');
  const save = async () => {
    setBusy(true);
    setMsg(null);
    const m = await saveName(nm).catch(() => 'Not saved: could not reach the server. Try again.');
    if (m) setMsg({ bad: true, t: m });
    else {
      const cleaned = cleanName(nm);
      nameDrafts.clear(lastName.current);
      if (cleaned.ok) {
        lastName.current = cleaned.name;
        setNm(cleaned.name);
      }
      toast('Name saved');
      reloadProfile(); // the cached profile carries the name too
      await refresh();
    }
    setBusy(false);
  };
  return (
    <>
      <Page emoji="⚙️" title="Settings" line="Make Zovix yours." tint={c.hero.violet} busy={false} reload={() => {}} err="">
        <PersonalizeCard onOpen={() => setPersonalize(true)} version={pver} />
        <CoachTarget id="settings:name">
          <View style={s.card}>
            <Text style={s.h2}>Your name</Text>
            <TextInput
              style={s.input}
              value={nm}
              onChangeText={(v) => {
                setNm(v);
                nameDrafts.set(lastName.current, v);
              }}
              placeholder="Your name"
              placeholderTextColor={c.mute}
              accessibilityLabel="Your name"
              maxLength={40}
            />
            {nameIsDirty(nm, lastName.current) && (
              <Text accessibilityLiveRegion="polite" style={[s.p, { color: c.down, marginBottom: sp.s }]}>
                {UNSAVED_NAME_LINE}
              </Text>
            )}
            {msg && <Text style={msg.bad ? s.err : s.ok}>{msg.t}</Text>}
            <Btn label="Save name" busy={busy} onPress={save} />
          </View>
        </CoachTarget>
        <CoachTarget id="settings:tools">
          <View style={s.card}>
            <Text style={s.h2}>Tools</Text>
            <Btn label="📊 Reports" alt onPress={() => setTool('reports')} />
            <Btn label="🔁 Recurring entries" alt onPress={() => setTool('recurring')} />
            <Btn label="🗂 Accounts and categories" alt onPress={() => setTool('manage')} />
            <Btn label="📄 Import and export CSV" alt onPress={() => setTool('csv')} />
          </View>
        </CoachTarget>
        <View style={s.card}>
          <Text style={s.h2}>Accounts</Text>
          <Text style={[s.p, { marginBottom: sp.m }]}>Choose which accounts are savings and which show on Home.</Text>
          <Btn label="Manage accounts" alt onPress={() => setAccounts(true)} />
        </View>
        <CoachTarget id="settings:delete">
          <View style={s.card}>
            <Text style={s.h2}>Delete my records</Text>
            {RECORDS_DELETE.map((line) => (
              <Text key={line} style={[s.p, { marginBottom: sp.s }]}>
                • {line}
              </Text>
            ))}
            <Btn label="🗑 Delete my records" alt onPress={() => setReset(true)} />
          </View>
        </CoachTarget>
        <CoachTarget id="settings:delete-account">
          <View style={[s.card, { borderColor: c.down }]}>
            <Text style={s.h2}>Delete my account</Text>
            <Text style={[s.p, { marginBottom: sp.m }]}>
              Removes your login and every record for good. This is different from deleting records: nothing is kept, and it cannot be
              undone.
            </Text>
            <Btn label="Delete my account" danger onPress={() => setDelAccount(true)} />
          </View>
        </CoachTarget>
        <CoachTarget id="settings:help">
          <View style={s.card}>
            <Text style={s.h2}>Help</Text>
            <Btn label="🧭 Take the tour of the tabs" alt onPress={onTour} />
            <Btn label="Show the first-run tutorial again" alt onPress={onReplay} />
            {sampleChecked && sampleCount === null && (
              <>
                <Text style={[s.p, { marginTop: sp.m }]}>Could not check for sample entries. Check your connection.</Text>
                <Btn label="Try again" alt onPress={recount} />
              </>
            )}
            {sampleCount !== null && sampleCount > 0 && (
              <>
                <Text style={[s.p, { marginTop: sp.m }]}>
                  {sampleCount} sample {sampleCount === 1 ? 'entry' : 'entries'} from the tour (labelled "Sample:") {sampleCount === 1 ? 'is' : 'are'} still in your account.
                </Text>
                <Btn label="🧹 Delete sample records" alt busy={sampleBusy} onPress={deleteSamples} />
              </>
            )}
            {!!sampleMsg && (
              <Text accessibilityLiveRegion="polite" style={sampleMsg.bad ? s.err : s.ok}>
                {sampleMsg.t}
              </Text>
            )}
          </View>
        </CoachTarget>
        <View style={s.card}>
          <Text style={s.h2}>Account</Text>
          <Btn label="Log out" alt onPress={confirmSignOut} />
        </View>
        <Text style={{ color: c.mute, textAlign: 'center', fontSize: t.caption }}>Zovix native {APP_VERSION}</Text>
      </Page>
      {tool === 'reports' && <Reports snap={snap} onClose={() => setTool('')} />}
      {tool === 'recurring' && <Recurring snap={snap} onClose={() => setTool('')} onChanged={() => void refresh()} />}
      {tool === 'csv' && <Csv snap={snap} onClose={() => setTool('')} onChanged={() => void refresh()} />}
      <Modal
        visible={tool === 'manage'}
        statusBarTranslucent
        navigationBarTranslucent
        animationType="slide"
        onRequestClose={() => setTool('')}
      >
        <View style={{ flex: 1, backgroundColor: c.bg }}>
          {tool === 'manage' && <Manage snap={snap} onClose={() => setTool('')} onChanged={refresh} />}
        </View>
      </Modal>
      <Personalize open={personalize} onClose={() => setPersonalize(false)} onChanged={() => {
          setPver((n) => n + 1);
          void refresh();
        }} />
      <DeleteAccount open={delAccount} onClose={() => setDelAccount(false)} />
      <ResetData open={reset} onClose={() => setReset(false)} onDone={() => void refresh()} />
      <AccountsSheet open={accounts} onClose={() => setAccounts(false)} snap={snap} refresh={refresh} />
    </>
  );
}
