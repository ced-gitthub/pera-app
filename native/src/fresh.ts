import AsyncStorage from '@react-native-async-storage/async-storage';
import { JUST_SIGNED_UP_KEY, flagMatches, flagValueFor } from './freshLogic';

// The sign-up screen sets the flag (tied to the email typed) when the code is confirmed in sign-up mode.
export const markJustSignedUp = (email: string) => AsyncStorage.setItem(JUST_SIGNED_UP_KEY, flagValueFor(email)).catch(() => {});

// Reads the flag and removes it in the same step, so it can be used at most once. True only if it was set for THIS account's email. False if storage fails.
export async function takeSignUpFlag(email: string): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(JUST_SIGNED_UP_KEY);
    if (stored !== null) await AsyncStorage.removeItem(JUST_SIGNED_UP_KEY);
    return flagMatches(stored, email);
  } catch {
    return false;
  }
}
