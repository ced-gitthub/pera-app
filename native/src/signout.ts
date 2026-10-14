import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { JUST_SIGNED_UP_KEY } from './freshLogic';
import { clearProfileMemo } from './profile';

const forgetSignUpFlag = () => AsyncStorage.removeItem(JUST_SIGNED_UP_KEY).catch(() => {}); // a pending sign-up flag never survives a sign-out

// The only place that signs out. Logging out is easy to hit by accident, so it always asks first and "Stay signed in" is the safe default.
export function confirmSignOut() {
  Alert.alert('Log out of Zovix?', 'You can sign back in any time with an email code. Your data stays safe.', [
    { text: 'Stay signed in', style: 'cancel' },
    { text: 'Log out', style: 'destructive', onPress: () => void forgetSignUpFlag().then(() => (clearProfileMemo(), supabase.auth.signOut())) },
  ]);
}

// After the server has deleted the account there is nothing left to confirm: just leave this phone signed out.
export const finishAfterDeletion = async () => {
  await forgetSignUpFlag();
  clearProfileMemo();
  return supabase.auth.signOut({ scope: 'local' });
};
