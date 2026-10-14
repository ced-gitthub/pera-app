import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { saveName } from './config';
import { nextProfileState, type LoadResult } from './profileFlow';
import { makeItYoursKey, parseCachedProfile, profileCacheKey, profileFromMeta, validateProfile, type Profile } from './profileLogic';

export type ProfileState = { uid: string; name: string; email: string; profile: Profile };
const FAIL = 'Could not save right now. Check your connection and try again.';

// The last profile seen, kept in memory (no flash inside a session) and on the phone (no flash after reopening). Cleared on sign-out.
let memo: ProfileState | null = null;
let lastUid = '';
/** Forget the profile on this phone (memory and the saved copy): on every kind of sign-out and after account deletion. */
export async function forgetProfile(): Promise<void> {
  const uid = memo?.uid || lastUid;
  memo = null;
  if (!uid) return;
  try {
    await AsyncStorage.removeItem(profileCacheKey(uid));
  } catch {
    /* nothing more to do */
  }
}
async function remember(st: ProfileState) {
  memo = st;
  lastUid = st.uid;
  try {
    await AsyncStorage.setItem(profileCacheKey(st.uid), JSON.stringify({ name: st.name, email: st.email, profile: st.profile }));
  } catch {
    /* the cache only saves a moment of waiting */
  }
}
/** The saved profile from this phone (no network), or null. */
export async function readCachedProfile(): Promise<ProfileState | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) return null;
    if (memo && memo.uid === uid) return memo;
    const c = parseCachedProfile(await AsyncStorage.getItem(profileCacheKey(uid)));
    return c ? { uid, ...c } : null;
  } catch {
    return null;
  }
}

/** The signed-in person's name and avatar settings. Reads the local session first (works offline), then asks the account for fresh data.
 * Returns null only when nobody is signed in. A failed read THROWS, so the caller keeps what it already shows. */
export async function loadProfile(): Promise<ProfileState | null> {
  const { data: local } = await supabase.auth.getSession();
  let u = local.session?.user ?? null;
  if (!u) return null;
  try {
    const fresh = await supabase.auth.getUser();
    if (fresh.data.user) u = fresh.data.user; // offline or expired token: keep the local copy
  } catch {
    /* keep the local copy */
  }
  const { data: row, error } = await supabase.from('profiles').select('name').eq('id', u.id).maybeSingle();
  if (error) throw new Error('profile');
  const name = typeof row?.name === 'string' ? row.name : '';
  const email = u.email ?? '';
  const st = { uid: u.id, name, email, profile: profileFromMeta(u.user_metadata, name, email) };
  void remember(st);
  return st;
}

/** Refresh the saved copy (after the name changed somewhere else, for example Settings). */
export const reloadProfile = () => void loadProfile().catch(() => {});

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

/** Load the profile once (and again when `reload()` is called). Starts from the last known profile, so nothing flashes. */
export function useProfile() {
  const [state, setStateRaw] = useState<ProfileState | null>(memo);
  const [failed, setFailed] = useState(false);
  const cur = useRef<ProfileState | null>(memo);
  const reload = useCallback(async () => {
    let r: LoadResult<ProfileState>;
    try {
      const v = await loadProfile();
      r = v ? { kind: 'ok', value: v } : { kind: 'signedOut' };
    } catch {
      r = { kind: 'error' };
    }
    const n = nextProfileState(cur.current, r);
    cur.current = n.state;
    setStateRaw(n.state);
    setFailed(n.failed);
  }, []);
  useEffect(() => {
    // show the last known profile at once (from this phone), then bring it up to date from the account
    void readCachedProfile().then((c) => {
      if (c && !cur.current) {
        cur.current = c;
        setStateRaw(c);
      }
    });
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
