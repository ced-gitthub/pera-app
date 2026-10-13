import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { cleanNewAccountWith, type FreshDb } from './freshCore';
import { JUST_SIGNED_UP_KEY, shouldCleanNewAccount } from './freshLogic';

// The sign-up screen sets the flag when the code is confirmed in sign-up mode.
export const markJustSignedUp = () => AsyncStorage.setItem(JUST_SIGNED_UP_KEY, '1').catch(() => {});

// Runs once, right after a sign-up on this phone. Returns a message only when the clean-up failed (the flag is kept so the next load retries).
export async function cleanIfNewlySignedUp(createdAt: string | undefined): Promise<string | null> {
  try {
    const flag = (await AsyncStorage.getItem(JUST_SIGNED_UP_KEY)) === '1';
    if (!flag) return null;
    if (!shouldCleanNewAccount(flag, createdAt, Date.now())) {
      await AsyncStorage.removeItem(JUST_SIGNED_UP_KEY); // too old to be a fresh account: drop the flag, touch nothing
      return null;
    }
    const m = await cleanNewAccountWith(supabase as unknown as FreshDb);
    if (!m) await AsyncStorage.removeItem(JUST_SIGNED_UP_KEY);
    return m;
  } catch {
    return null;
  }
}
