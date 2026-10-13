import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { saveName } from './config';
import { makeItYoursKey, profileFromMeta, validateProfile, type Profile } from './profileLogic';

export type ProfileState = { uid: string; name: string; email: string; profile: Profile };
const FAIL = 'Could not save right now. Check your connection and try again.';

/** The signed-in person's name and avatar settings (from the profiles table and their own account metadata). Null while loading or signed out. */
export async function loadProfile(): Promise<ProfileState | null> {
  const { data } = await supabase.auth.getUser();
  const u = data.user;
  if (!u) return null;
  const { data: row } = await supabase.from('profiles').select('name').eq('id', u.id).maybeSingle();
  const name = typeof row?.name === 'string' ? row.name : '';
  const email = u.email ?? '';
  return { uid: u.id, name, email, profile: profileFromMeta(u.user_metadata, name, email) };
}

/** Validate and save avatar, colour, frame and status. Returns a friendly error or null. */
export async function saveProfile(p: Profile): Promise<string | null> {
  const v = validateProfile(p);
  if (!v.ok) return v.message;
  try {
    const { error } = await supabase.auth.updateUser({
      data: { avatar: v.profile.avatar, avatarColor: v.profile.avatarColor, frame: v.profile.frame, status: v.profile.status },
    });
    return error ? FAIL : null;
  } catch {
    return FAIL;
  }
}

/** Load the profile once (and again when `reload()` is called). */
export function useProfile() {
  const [state, setState] = useState<ProfileState | null>(null);
  const [failed, setFailed] = useState(false);
  const reload = useCallback(async () => {
    try {
      setState(await loadProfile());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { state, failed, reload };
}

export { saveName };

/** The one-time "Make it yours" step: has this person already seen it? Storage trouble counts as seen, so nobody is nagged. */
export async function makeItYoursSeen(uid: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(makeItYoursKey(uid))) === '1';
  } catch {
    return true;
  }
}
export async function markMakeItYoursSeen(uid: string): Promise<void> {
  try {
    await AsyncStorage.setItem(makeItYoursKey(uid), '1');
  } catch {
    // ignore
  }
}
