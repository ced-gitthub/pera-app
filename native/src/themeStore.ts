import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { applyTheme, themeState } from './ui';
import { THEME_KEY, isThemeId, resolveThemeId, type ThemeId } from './themeLogic';

// The theme choice: applied to `c`/`s` in place, remembered on the phone (so it also applies before sign-in) and, when signed in, in the
// person's own account metadata (so it follows them to another phone). The app root remounts its tree when commitTheme() bumps the key.
let key = 0;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/** Re-render the whole app with the current colours. Call it when the person is done choosing (e.g. closing the editor). */
export function commitTheme() {
  key += 1;
  listeners.forEach((fn) => fn());
}
export const useThemeKey = () => useSyncExternalStore(subscribe, () => key);

/** Apply a theme now (colours in `c` and `s` change in place), remember it, and sync it to the account. Returns a friendly error or null. */
export async function setTheme(id: ThemeId): Promise<string | null> {
  const used = applyTheme(id);
  try {
    await AsyncStorage.setItem(THEME_KEY, used);
  } catch {
    // the theme still works for this session
  }
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;
    const { error } = await supabase.auth.updateUser({ data: { theme: used } });
    return error ? 'Theme applied on this phone, but it could not be saved to your account. Try again later.' : null;
  } catch {
    return 'Theme applied on this phone, but it could not be saved to your account. Try again later.';
  }
}

/** After sign-in: if the account has a theme saved on another phone, switch to it. */
export async function adoptAccountTheme(metaTheme: unknown): Promise<void> {
  if (!isThemeId(metaTheme) || metaTheme === themeState.id) return;
  applyTheme(resolveThemeId(metaTheme));
  try {
    await AsyncStorage.setItem(THEME_KEY, metaTheme);
  } catch {
    // ignore
  }
  commitTheme();
}
