import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Flags } from './logic';

// The website keeps these as cookies; here they are small flags on the device, one set PER ACCOUNT (wizard progress belongs to the account, not the phone).
// They only remember what was SEEN. Whether a step is done always comes from real data.
const NAMES: Record<keyof Flags, string> = {
  onboarded: 'zv_onboarded',
  wizard: 'zv_wizard',
  balances: 'zv_wizard_bal',
  toured: 'zv_toured',
};
const key = (uid: string, k: keyof Flags) => `${NAMES[k]}:${uid}`;
const OFF: Flags = { onboarded: false, wizard: false, balances: false, toured: false };

export async function readFlags(uid: string): Promise<Flags> {
  try {
    const ks = Object.keys(NAMES) as (keyof Flags)[];
    const v = await AsyncStorage.multiGet(ks.map((k) => key(uid, k)));
    const on = (k: keyof Flags) => v.find(([x]) => x === key(uid, k))?.[1] === '1';
    return { onboarded: on('onboarded'), wizard: on('wizard'), balances: on('balances'), toured: on('toured') };
  } catch {
    return OFF;
  }
}
// Returns false when the flags could not be stored, so the caller can say so instead of looping silently.
export async function setFlags(uid: string, change: Partial<Flags>): Promise<boolean> {
  try {
    const e = Object.entries(change) as [keyof Flags, boolean][];
    if (e.length) await AsyncStorage.multiSet(e.map(([k, on]) => [key(uid, k), on ? '1' : '0']));
    return true;
  } catch {
    return false;
  }
}

// The tour of the tabs is shown once per account, right after the first-run steps. Stored apart from the wizard flags so replaying the wizard never re-triggers it.
const tourKey = (uid: string) => `zv_tab_tour:${uid}`;
export async function tabTourSeen(uid: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(tourKey(uid))) === '1';
  } catch {
    return true; // if storage is broken, never nag
  }
}
export const markTabTourSeen = (uid: string) => AsyncStorage.setItem(tourKey(uid), '1').catch(() => {});
