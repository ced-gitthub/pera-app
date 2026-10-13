import AsyncStorage from '@react-native-async-storage/async-storage';
import { JUST_SIGNED_UP_KEY } from './freshLogic';

// The sign-up screen sets the flag when the code is confirmed in sign-up mode.
export const markJustSignedUp = () => AsyncStorage.setItem(JUST_SIGNED_UP_KEY, '1').catch(() => {});

// Reads the flag and removes it in the same step, so it can be used at most once. False if storage fails.
export async function takeSignUpFlag(): Promise<boolean> {
  try {
    const on = (await AsyncStorage.getItem(JUST_SIGNED_UP_KEY)) === '1';
    if (on) await AsyncStorage.removeItem(JUST_SIGNED_UP_KEY);
    return on;
  } catch {
    return false;
  }
}
