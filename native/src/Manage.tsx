import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMinor } from '../../src/core/money';
import { minorToInput } from '../../src/lib/validate';
import type { Snapshot, Category } from './logic';
import { Btn } from './Btn';
import { HeaderClose, Sheet } from './Sheet';
import { Chip } from './Tabs';
import { useToast } from './Toast';
import { UNSAVED_TEXT_ANY, unsavedButtons } from './unsaved';
import { UNSAVED_TITLE } from './profileLogic';
import { isManageDraftDirty, type ManageDraft } from './manageDirty';
import { c, s, sp, t } from './ui';
import {
  ACCOUNT_TYPES,
  MAX_ACCOUNTS,
  MAX_CATEGORIES,
  NAME_MAX,
  SHORT_MAX,
  deleteWarning,
  validateAccount,
  validateCategory,
  type AccountDraft,
} from './manageLogic';
import {
  addAccount,
  addCategory,
  deleteAccount,
  deleteCategory,
  loadAccountRows,
  renameCategory,
  updateAccount,
  type AccountRow,
} from './manageApi';

type Target = { kind: 'account'; id: string | null } | { kind: 'category'; id: string | null } | null;
const NEW_ACCOUNT: AccountDraft = { name: '', type: 'cash', short: '', opening: '' };
const OFFLINE_SAVE = 'Not saved: could not reach the server. Try again.';
const OFFLINE_DELETE = 'Not deleted: could not reach the server. Try again.';
const typeLabel = (id: string) => ACCOUNT_TYPES.find((x) => x.id === id)?.label ?? 'Other';

// Add, rename and delete accounts and categories. The database refuses a delete while entries still use the row, and we say so plainly.
export function Manage({
  snap,
  onClose: leave,
  onChanged,
  startAdd,
}: {
  snap: Snapshot;
  onClose: () => void;
  onChanged: () => void | Promise<unknown>;
  startAdd?: boolean; // open straight on the new-account form
}) {
  const { top, bottom } = useSafeAreaInsets();
  const toast = useToast();
  const [rows, setRows] = useState<AccountRow[] | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [target, setTarget] = useState<Target>(null);
  const [acct, setAcct] = useState<AccountDraft>(NEW_ACCOUNT);
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<'income' | 'expense'>('expense');
  const [initial, setInitial] = useState<ManageDraft>({ kind: 'account', account: NEW_ACCOUNT, catName: '', catType: 'expense' }); // the form as opened
  const [err, setErr] = useState(''); // inside the sheet
  const [note, setNote] = useState(''); // on the page (delete results)
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setRows(await loadAccountRows());
      setLoadErr('');
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Could not load your accounts. Check your connection.');
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (startAdd) openAccount(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changed = async () => {
    await reload();
    await onChanged();
  };

  const openAccount = (a: AccountRow | null) => {
    setErr('');
    setNote('');
    const d = a ? { name: a.name, type: a.account_type, short: a.short_name ?? '', opening: minorToInput(a.opening_balance_minor) } : NEW_ACCOUNT;
    setAcct(d);
    setInitial({ kind: 'account', account: d, catName: '', catType: 'expense' });
    setTarget({ kind: 'account', id: a?.id ?? null });
  };
  const openCategory = (cat: Category | null) => {
    setErr('');
    setNote('');
    setCatName(cat?.name ?? '');
    setCatType(cat?.type ?? 'expense');
    setInitial({ kind: 'category', account: NEW_ACCOUNT, catName: cat?.name ?? '', catType: cat?.type ?? 'expense' });
    setTarget({ kind: 'category', id: cat?.id ?? null });
  };

  // true = saved (the unsaved-changes prompt closes only then)
  const save = async (): Promise<boolean> => {
    if (busy || !target) return false;
    setErr('');
    let problem: string | null;
    if (target.kind === 'account') {
      const v = validateAccount(acct, rows ?? [], target.id);
      if (!v.ok) return fail(v.message);
      setBusy(true);
      problem = await (target.id ? updateAccount(target.id, v.value) : addAccount(v.value)).catch(() => OFFLINE_SAVE);
    } else {
      const v = validateCategory({ name: catName, type: catType }, snap.categories, target.id);
      if (!v.ok) return fail(v.message);
      setBusy(true);
      problem = await (target.id ? renameCategory(target.id, v.value.name) : addCategory(v.value)).catch(() => OFFLINE_SAVE);
    }
    setBusy(false);
    if (problem) return fail(problem);
    const what = target.kind === 'account' ? 'Account' : 'Category';
    setTarget(null);
    toast(target.id ? `${what} saved` : `${what} added`);
    await changed();
    return true;
  };
  const fail = (m: string) => {
    setErr(m);
    return false;
  };

  const confirmDelete = (kind: 'account' | 'category', id: string, name: string) => {
    if (busy) return;
    Alert.alert(`Delete ${name}?`, deleteWarning(kind, name), [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          setNote('');
          const problem = await (kind === 'account' ? deleteAccount(id) : deleteCategory(id)).catch(() => OFFLINE_DELETE);
          setBusy(false);
          if (problem) return setNote(problem);
          toast(`Deleted ${name}`);
          await changed();
        },
      },
    ]);
  };

  const current: ManageDraft = { kind: target?.kind ?? 'account', account: acct, catName, catType };
  const dirty = !!target && isManageDraftDirty(initial, current);
  // Close and the Android back button ask first when a form has unsaved changes.
  const onClose = () => {
    if (dirty) Alert.alert(UNSAVED_TITLE, UNSAVED_TEXT_ANY, unsavedButtons({ onClose: leave, onSave: save }));
    else leave();
  };
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeRef.current();
      return true;
    });
    return () => sub.remove();
  }, []);

  const editing = target?.id != null;
  const isAcct = target?.kind === 'account';
  const title = !target ? '' : `${editing ? 'Edit' : 'Add'} ${isAcct ? 'account' : 'category'}`;
  const field = (k: keyof AccountDraft) => (v: string) => setAcct((d) => ({ ...d, [k]: v }));
  const atAcctCap = (rows?.length ?? 0) >= MAX_ACCOUNTS;
  const atCatCap = snap.categories.length >= MAX_CATEGORIES;

  const link = (label: string, a11y: string, onPress: () => void, danger?: boolean) => (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} disabled={busy && !!danger} onPress={onPress} style={{ padding: sp.m, minHeight: 48, justifyContent: 'center' }}>
      <Text style={{ color: danger ? c.down : c.primary, fontSize: t.body, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );

  const catGroup = (type: 'income' | 'expense', label: string) => (
    <View style={{ marginTop: sp.s }}>
      <Text style={[s.p, { marginBottom: sp.xs }]}>{label}</Text>
      {snap.categories
        .filter((x) => x.type === type)
        .map((cat) => (
          <View key={cat.id} style={[s.row, { alignItems: 'center' }]}>
            <Text style={{ flex: 1, color: c.ink, fontSize: t.body }}>{cat.name}</Text>
            {link('Rename', `Rename ${cat.name}`, () => openCategory(cat))}
            {link('Delete', `Delete ${cat.name}`, () => confirmDelete('category', cat.id, cat.name), true)}
          </View>
        ))}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: top + sp.s,
          paddingHorizontal: sp.l,
          paddingBottom: sp.s,
          borderBottomWidth: 1,
          borderBottomColor: c.line,
        }}
      >
        <Text style={[s.h1, { flex: 1 }]} accessibilityRole="header">
          Accounts and categories
        </Text>
        <HeaderClose label="Close" onPress={onClose} />
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: sp.l, paddingHorizontal: sp.l, paddingBottom: Math.max(bottom, sp.xl) + sp.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[s.p, { marginVertical: sp.s }]}>
          Names cannot repeat. Something your entries use cannot be deleted; rename it instead.
        </Text>
        {!!note && <Text style={s.err}>{note}</Text>}

        <View style={s.card}>
          <Text style={s.h2}>Accounts</Text>
          {rows === null && !loadErr && <ActivityIndicator color={c.primary} />}
          {!!loadErr && (
            <>
              <Text style={s.err}>{loadErr}</Text>
              <Btn label="Try again" alt onPress={() => void reload()} />
            </>
          )}
          {rows?.length === 0 && <Text style={s.p}>No accounts yet. Add one to start tracking.</Text>}
          {rows?.map((a) => (
            <View key={a.id} style={[s.row, { alignItems: 'center' }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.ink, fontSize: t.body, fontWeight: '600' }}>{a.name}</Text>
                <Text style={s.p}>
                  {typeLabel(a.account_type)}
                  {a.short_name ? ` · "${a.short_name}"` : ''} · starts at {formatMinor(a.opening_balance_minor)}
                </Text>
              </View>
              {link('Edit', `Edit ${a.name}`, () => openAccount(a))}
              {link('Delete', `Delete ${a.name}`, () => confirmDelete('account', a.id, a.name), true)}
            </View>
          ))}
          {atAcctCap ? (
            <Text style={s.p}>You have {MAX_ACCOUNTS} accounts, the most allowed. Delete one to add another.</Text>
          ) : (
            <Btn label="Add account" alt onPress={() => openAccount(null)} />
          )}
        </View>

        <View style={s.card}>
          <Text style={s.h2}>Categories</Text>
          {catGroup('expense', 'Spending')}
          {catGroup('income', 'Income')}
          {atCatCap ? (
            <Text style={s.p}>You have {MAX_CATEGORIES} categories, the most allowed. Delete one to add another.</Text>
          ) : (
            <Btn label="Add category" alt onPress={() => openCategory(null)} />
          )}
        </View>
      </ScrollView>

      <Sheet
        open={!!target}
        title={title}
        dirty={dirty}
        onSave={save}
        onClose={() => !busy && setTarget(null)}
        footer={<Btn label={editing ? 'Save changes' : 'Add'} busy={busy} onPress={() => void save()} />}
      >
        {!!err && <Text style={s.err}>{err}</Text>}
        {isAcct ? (
          <>
            <Text style={s.p}>Name</Text>
            <TextInput
              accessibilityLabel="Account name"
              style={s.input}
              value={acct.name}
              onChangeText={field('name')}
              maxLength={NAME_MAX}
              placeholder="e.g. BPI"
              placeholderTextColor={c.mute}
            />
            <Text style={s.p}>Type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: sp.s }}>
              {ACCOUNT_TYPES.map((x) => (
                <Chip key={x.id} label={x.label} on={acct.type === x.id} press={() => field('type')(x.id)} />
              ))}
            </View>
            <Text style={s.p}>Short name for quick add (optional)</Text>
            <TextInput
              accessibilityLabel="Short name"
              style={s.input}
              value={acct.short}
              onChangeText={field('short')}
              maxLength={SHORT_MAX}
              autoCapitalize="none"
              placeholder="e.g. bpi"
              placeholderTextColor={c.mute}
            />
            <Text style={s.p}>Starting balance (can be negative, like -500 for a card you owe)</Text>
            <TextInput
              accessibilityLabel="Starting balance"
              style={s.input}
              value={acct.opening}
              onChangeText={field('opening')}
              keyboardType="numbers-and-punctuation"
              placeholder="0"
              placeholderTextColor={c.mute}
            />
          </>
        ) : (
          <>
            <Text style={s.p}>Name</Text>
            <TextInput
              accessibilityLabel="Category name"
              style={s.input}
              value={catName}
              onChangeText={setCatName}
              maxLength={NAME_MAX}
              placeholder="e.g. Pets"
              placeholderTextColor={c.mute}
            />
            {editing ? (
              <Text style={[s.p, { marginBottom: sp.m }]}>
                {catType === 'income' ? 'Income' : 'Spending'} category (the type cannot change)
              </Text>
            ) : (
              <View style={{ flexDirection: 'row', marginBottom: sp.s }}>
                <Chip label="Spending" on={catType === 'expense'} press={() => setCatType('expense')} />
                <Chip label="Income" on={catType === 'income'} press={() => setCatType('income')} />
              </View>
            )}
          </>
        )}
      </Sheet>
    </View>
  );
}
