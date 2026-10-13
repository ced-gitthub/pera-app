import AsyncStorage from '@react-native-async-storage/async-storage';

// The website keeps these as cookies; here they are small flags on the device. They only remember what was SEEN. Whether a step is done always comes from real data.
const KEYS = { onboarded: 'zv_onboarded', wizard: 'zv_wizard', balances: 'zv_wizard_bal', toured: 'zv_toured' } as const;
export type Flags = { onboarded: boolean; wizard: boolean; balances: boolean; toured: boolean };

export async function readFlags(): Promise<Flags> {
  try {
    const v = await AsyncStorage.multiGet(Object.values(KEYS));
    const on = (k: string) => v.find(([x]) => x === k)?.[1] === '1';
    return { onboarded: on(KEYS.onboarded), wizard: on(KEYS.wizard), balances: on(KEYS.balances), toured: on(KEYS.toured) };
  } catch {
    return { onboarded: false, wizard: false, balances: false, toured: false };
  }
}
export const setFlag = (k: keyof Flags, on = true) => AsyncStorage.setItem(KEYS[k], on ? '1' : '0').catch(() => {});
export const clearFlags = () => AsyncStorage.multiRemove(Object.values(KEYS)).catch(() => {});
