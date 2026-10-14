import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { formatMinor } from '../../src/core/money';
import type { Snapshot } from './data';
import { accountsOverview, type OverviewRow } from './logic';
import { Page } from './Tabs';
import { AccountsSheet } from './Settings';
import { Manage } from './Manage';
import { CoachTarget } from './Coach';
import { c, s, sp, t } from './ui';

const GROUPS: { id: OverviewRow['group']; title: string; hint: string }[] = [
  { id: 'spendable', title: 'Spendable', hint: 'Money you can spend now' },
  { id: 'savings', title: '🐷 Savings', hint: 'Kept out of what you can spend' },
];

// Overview of every account: what you can spend, what is saved, what you owe, and the net total. Tap an account to change how it counts.
export function AccountsTab({ snap, refresh }: { snap: Snapshot; refresh: () => Promise<string> }) {
  const o = accountsOverview(snap);
  const [edit, setEdit] = useState(false);
  const [manage, setManage] = useState(false);
  const [add, setAdd] = useState(false);
  const first = GROUPS.flatMap((g) => o.rows.filter((x) => x.group === g.id)).find((x) => x.id !== 'none')?.id; // the tour points at the first real account row
  const stat = (label: string, amount: number, color: string, hint?: string) => (
    <View style={[s.card, { flexGrow: 1, width: '48%', marginBottom: 0, padding: sp.m }]}>
      <Text style={{ color: c.mute, fontSize: t.caption }}>{label}</Text>
      <Text style={{ color, fontSize: t.lead, fontWeight: '800' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {formatMinor(amount)}
      </Text>
      {!!hint && <Text style={{ color: c.mute, fontSize: t.caption }}>{hint}</Text>}
    </View>
  );
  return (
    <>
      <Page
        emoji="👛"
        title="Accounts"
        line="Where your money sits right now."
        tint={c.hero.teal}
        busy={false}
        reload={() => void refresh()}
        err=""
        onGear={() => {
          setAdd(false);
          setManage(true);
        }}
        gearLabel="Manage"
        gearId="accounts:manage"
        fab={{
          label: '＋ Add account',
          onPress: () => {
            setAdd(true);
            setManage(true);
          },
        }}
      >
        <CoachTarget id="accounts:stats" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.s, marginBottom: sp.l }}>
          {stat('Spendable', o.spendable, c.up)}
          {stat('Savings', o.savings, c.reward)}
          {stat('Total', o.total, c.ink)}
          {stat('Debt included', o.owed, o.owed > 0 ? c.down : c.mute, 'Already subtracted from Spendable')}
        </CoachTarget>
        {snap.accounts.length === 0 ? (
          <CoachTarget id="accounts:rows" empty>
            <Text style={s.p}>No accounts yet. Tap Add account to create your first one.</Text>
          </CoachTarget>
        ) : (
          <Text style={[s.p, { marginBottom: sp.m }]}>Tap an account to choose whether it is savings or shows on Home.</Text>
        )}
        {GROUPS.map((g) => {
          const rows = o.rows.filter((x) => x.group === g.id);
          if (!rows.length) return null;
          return (
            <View key={g.id} style={{ marginBottom: sp.m }}>
              <Text style={s.h2}>{g.title}</Text>
              {rows.map((x) =>
                x.id === 'none' ? (
                  <View key={x.id} style={[s.card, { flexDirection: 'row', alignItems: 'center', marginBottom: sp.s }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.ink, fontSize: t.body, fontWeight: '700' }}>{x.name}</Text>
                      <Text style={{ color: c.mute, fontSize: t.caption }}>Entries saved without an account</Text>
                    </View>
                    <Text style={{ color: x.balance < 0 ? c.down : c.ink, fontSize: t.lead, fontWeight: '800' }}>
                      {formatMinor(x.balance)}
                    </Text>
                  </View>
                ) : (
                  <CoachTarget key={x.id} id="accounts:rows" on={first === x.id}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${x.name} ${formatMinor(x.balance)}. Tap to edit`}
                      onPress={() => setEdit(true)}
                      style={({ pressed }) => [
                        s.card,
                        { flexDirection: 'row', alignItems: 'center', marginBottom: sp.s, opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: c.ink, fontSize: t.body, fontWeight: '700' }}>{x.name}</Text>
                        <Text style={{ color: c.mute, fontSize: t.caption }}>
                          {g.hint}
                          {x.showOnHome ? '' : ' · hidden on Home'}
                        </Text>
                      </View>
                      <Text style={{ color: x.balance < 0 ? c.down : c.ink, fontSize: t.lead, fontWeight: '800' }}>
                        {formatMinor(x.balance)}
                      </Text>
                      {x.balance < 0 && <Text style={[s.chipStatic, { color: c.down, fontSize: t.caption, marginLeft: sp.s }]}>owed</Text>}
                      <Text style={{ color: c.mute, fontSize: t.title, marginLeft: sp.s }}>›</Text>
                    </Pressable>
                  </CoachTarget>
                ),
              )}
            </View>
          );
        })}
      </Page>
      <AccountsSheet open={edit} onClose={() => setEdit(false)} snap={snap} refresh={refresh} />
      <Modal visible={manage} statusBarTranslucent navigationBarTranslucent animationType="slide" onRequestClose={() => setManage(false)}>
        <View style={{ flex: 1, backgroundColor: c.bg }}>
          {manage && <Manage startAdd={add} snap={snap} onClose={() => setManage(false)} onChanged={refresh} />}
        </View>
      </Modal>
    </>
  );
}
