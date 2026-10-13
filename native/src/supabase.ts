import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

// Publishable values only (the website ships the same ones). Row access is enforced by Postgres RLS.
const x = Constants.expoConfig?.extra as { supabaseUrl: string; supabasePublishableKey: string };
export const supabase = createClient(x.supabaseUrl, x.supabasePublishableKey, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, flowType: 'pkce' },
});
