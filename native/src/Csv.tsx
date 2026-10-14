import { withExternal } from './externalActivity';
import { useRef, useState } from 'react';
import { Share, Text, TextInput, View } from 'react-native';
import type { Snapshot } from './logic';
import { Sheet } from './Sheet';
import { Btn } from './Btn';
import { checkImport, exportCsv, runImport } from './csvApi';
import {
  checkExportRange,
  checkShareSize,
  checkSummary,
  exportDoneMessage,
  importMessage,
  problemLines,
  type ImportPlan,
} from './csvLogic';
import { useToast } from './Toast';
import { csvDirty, importedToast } from './csvMineLogic';
import { c, s, sp } from './ui';

type Msg = { bad: boolean; t: string } | null;
type Work = '' | 'export' | 'check' | 'import';

// Export your entries as CSV text (share sheet) and import CSV text pasted from the website or another app. Mount it only while it should show.
export function Csv({ snap, onClose, onChanged }: { snap: Snapshot; onClose: () => void; onChanged: () => void | Promise<void> }) {
  const [work, setWork] = useState<Work>('');
  const lock = useRef(false); // a second tap in the same instant is ignored, not queued
  const [text, setText] = useState('');
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [exportMsg, setExportMsg] = useState<Msg>(null);
  const [importMsg, setImportMsg] = useState<Msg>(null);
  const [note, setNote] = useState('');
  const toast = useToast();

  const run = async (kind: Work, fn: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setWork(kind);
    try {
      await fn();
    } finally {
      lock.current = false;
      setWork('');
    }
  };

  const doExport = () =>
    run('export', async () => {
      setExportMsg(null);
      const r = checkExportRange(fromText, toText);
      if (!r.ok) return setExportMsg({ bad: true, t: r.message });
      try {
        const out = await exportCsv(snap, r.range);
        if (!out.count)
          return setExportMsg({
            bad: true,
            t:
              r.range.from || r.range.to
                ? 'No entries in that date range. Change From or To.'
                : 'Nothing to export yet. Add an entry first.',
          });
        const size = checkShareSize(out.text, out.count);
        if (!size.ok) return setExportMsg({ bad: true, t: size.message });
        const res = await withExternal(() => Share.share({ message: out.text, title: 'Zovix export' }));
        if (res.action === Share.dismissedAction) return setExportMsg({ bad: true, t: 'Sharing was cancelled, so nothing was exported.' });
        setExportMsg({ bad: false, t: exportDoneMessage(out.count, r.range) });
      } catch (e) {
        const m = e instanceof Error && /export|connection/i.test(e.message) ? e.message : 'Could not open the share sheet. Try again.';
        setExportMsg({ bad: true, t: m });
      }
    });

  const doCheck = () =>
    run('check', async () => {
      setImportMsg(null);
      setNote('');
      setPlan(null);
      try {
        const r = await checkImport(text, snap);
        setPlan(r.plan);
        if (!r.dupCheck) setNote('Could not look for earlier imports. Rows you already imported are still skipped when you import.');
      } catch {
        setImportMsg({ bad: true, t: 'Could not check the text. Check your connection and try again.' });
      }
    });

  const doImport = () =>
    run('import', async () => {
      if (!plan || plan.blocked || !plan.rows.length) return;
      setImportMsg(null);
      try {
        const r = await runImport(plan);
        setImportMsg({ bad: !!r.error, t: importMessage(r) });
        if (r.added > 0) {
          setText('');
          setPlan(null);
          toast(importedToast(r.added));
          await onChanged();
        } else if (!r.error) setPlan(null);
      } catch {
        setImportMsg({ bad: true, t: 'Import failed. Check your connection and try again; nothing is added twice.' });
      }
    });

  const ready = !!plan && !plan.blocked && plan.rows.length > 0;
  return (
    <Sheet
      open
      title="Export and import"
      onClose={onClose}
      dirty={csvDirty(text)}
      footer={
        ready ? <Btn label={`Import ${plan!.rows.length.toLocaleString('en-US')} rows`} busy={work === 'import'} onPress={doImport} /> : undefined
      }
    >
      <View style={s.card}>
        <Text style={s.h2}>Export</Text>
        <Text style={[s.p, { marginBottom: sp.m }]}>
          Share your entries as CSV text. Open it in a spreadsheet, or import it on the website. Leave From and To empty to share
          everything, or fill them (YYYY-MM-DD) to share only that period. Very large exports must be split by date range.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.s }}>
          <View style={{ flexGrow: 1, flexBasis: '100%' }}>
            <Text style={s.p}>From (YYYY-MM-DD)</Text>
            <TextInput
              style={s.input}
              accessibilityLabel="Export from date, YYYY-MM-DD, empty for everything"
              placeholder="From (YYYY-MM-DD)"
              placeholderTextColor={c.mute}
              autoCapitalize="none"
              autoCorrect={false}
              value={fromText}
              onChangeText={setFromText}
              editable={work === ''}
            />
          </View>
          <View style={{ flexGrow: 1, flexBasis: '100%' }}>
            <Text style={s.p}>To (YYYY-MM-DD)</Text>
            <TextInput
              style={s.input}
              accessibilityLabel="Export to date, YYYY-MM-DD, empty for everything"
              placeholder="To (YYYY-MM-DD)"
              placeholderTextColor={c.mute}
              autoCapitalize="none"
              autoCorrect={false}
              value={toText}
              onChangeText={setToText}
              editable={work === ''}
            />
          </View>
        </View>
        {!!exportMsg && <Text style={exportMsg.bad ? s.err : s.ok}>{exportMsg.t}</Text>}
        <Btn label="Export my entries" busy={work === 'export'} onPress={doExport} />
      </View>

      <View style={s.card}>
        <Text style={s.h2}>Import</Text>
        <Text style={[s.p, { marginBottom: sp.m }]}>
          Paste CSV text with the columns date, type, amount, category, description, notes, account, to_account. Up to 5,000 rows at a time.
          Rows you already imported are skipped, so importing the same text twice is safe.
        </Text>
        <TextInput
          style={[s.input, { minHeight: 160, textAlignVertical: 'top' }]}
          accessibilityLabel="CSV text to import"
          placeholder="date,type,amount,category,description,notes,account,to_account"
          placeholderTextColor={c.mute}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          value={text}
          onChangeText={(v) => {
            setText(v);
            setPlan(null);
            setNote('');
          }}
          editable={work === ''}
        />
        {!!importMsg && <Text style={importMsg.bad ? s.err : s.ok}>{importMsg.t}</Text>}
        {!!plan && (
          <View style={{ marginBottom: sp.s }}>
            <Text style={plan.blocked || !plan.rows.length ? s.err : s.ok}>{checkSummary(plan)}</Text>
            {!!note && <Text style={s.p}>{note}</Text>}
            {problemLines(plan.problems).map((l, i) => (
              <Text key={i} style={s.err}>
                {l}
              </Text>
            ))}
          </View>
        )}
        <Btn label="Check" alt busy={work === 'check'} onPress={doCheck} />
      </View>
    </Sheet>
  );
}
