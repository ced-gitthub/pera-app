import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { formatMinor } from '../../src/core/money';
import type { Snapshot } from './data';
import { accountsOverview, type OverviewRow } from './logic';
import { Page } from './Tabs';
import { AccountsSheet } from './Settings';
import { Manage } from './Manage';
import { c, s, sp, t } from './ui';

const GROUPS: { id: OverviewRow['group']; title: string; hint: string }[] = [
  { id: 'spendable', title: 'Spendable', hint: 'Money you can spend now' },
  { id: 'savings', title: '🐷 Savings', hint: 'Kept out of what you can spend' },
  { id: 'owed', title: 'You owe', hint: 'Cards or accounts below zero' },
];

// Overview of every account: what you can spend, what is saved, what you owe, and the net total. Tap an account to change how it counts.
export function AccountsTab({ snap, refresh }: { snap: Snapshot; refresh: () => Promise<string> }) {
  const o = accountsOverview(snap);
  const [edit, setEdit] = useState(false);
  const [manage, setManage] = useState(false);
  const stat = (label: string, amount: number, color: string) => (
    <View style={[s.card, { flexGrow: 1, width: '48%', marginBottom: 0, padding: sp.m }]}>
      <Text style={{ color: c.mute, fontSize: t.caption }}>{label}</Text>
      <Text style={{ color, fontSize: t.lead, fontWeight: '800' }} numberOfLines={1}>
        {formatMinor(amount)}
      </Text>
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
        onGear={() => setManage(true)}
        gearLabel="Manage"
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.s, marginBottom: sp.l }}>
          {stat('Spendable', o.spendable, c.up)}
          {stat('Savings', o.savings, c.reward)}
          {stat('You owe', o.owed, o.owed > 0 ? c.down : c.mute)}
          {stat('Net total', o.total, c.ink)}
        </View>
        <Text style={[s.p, { marginBottom: sp.m }]}>Tap an account to choose whether it is savings or shows on Home.</Text>
        {GROUPS.map((g) => {
          const rows = o.rows.filter((x) => x.group === g.id);
          if (!rows.length) return null;
          return (
            <View key={g.id} style={{ marginBottom: sp.m }}>
              <Text style={s.h2}>{g.title}</Text>
              {rows.map((x) => (
                <Pressable
                  key={x.id}
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
                  <Text style={{ color: c.mute, fontSize: t.title, marginLeft: sp.s }}>›</Text>
                </Pressable>
              ))}
            </View>
          );
        })}
      </Page>
      <AccountsSheet open={edit} onClose={() => setEdit(false)} snap={snap} refresh={refresh} />
      <Modal visible={manage} statusBarTranslucent navigationBarTranslucent animationType="slide" onRequestClose={() => setManage(false)}>
        <View style={{ flex: 1, backgroundColor: c.bg }}>
          {manage && <Manage snap={snap} onClose={() => setManage(false)} onChanged={refresh} />}
        </View>
      </Modal>
    </>
  );
}
