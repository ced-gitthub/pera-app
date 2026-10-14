// Pure rules for the profile screens (no react-native), tested in tests/native-polish.test.ts.
export type LoadResult<T> = { kind: 'ok'; value: T } | { kind: 'signedOut' } | { kind: 'error' };

/** What to show after a load: a failed load never throws away what is already on screen (the cached profile); only a real sign-out empties it. */
export function nextProfileState<T>(prev: T | null, r: LoadResult<T>): { state: T | null; failed: boolean } {
  if (r.kind === 'ok') return { state: r.value, failed: false };
  if (r.kind === 'signedOut') return { state: null, failed: false };
  return { state: prev, failed: prev === null };
}

/** The form takes the account's copy while the person has not edited anything, so a stale cached copy is never saved back over newer data. */
export const adoptServerProfile = (x: { dirty: boolean; hasSaved: boolean }): boolean => !x.hasSaved || !x.dirty;

/** The pinned Save button only spins while a save is really running (never while the editor has simply not reported yet). */
export const saveButtonBusy = (editor: { busy: boolean } | null): boolean => !!editor?.busy;

/** The last known value plus a generation counter: a load that started before a sign-out can never write its (old account's) result afterwards. */
export function createProfileMemo<T extends { uid: string }>() {
  let value: T | null = null;
  let gen = 0;
  let lastUid = '';
  return {
    get: (): T | null => value,
    /** Call when a load starts; pass the token to remember(). */
    begin: (): number => gen,
    isCurrent: (token: number): boolean => token === gen,
    remember(token: number, st: T): boolean {
      if (token !== gen) return false;
      value = st;
      lastUid = st.uid;
      return true;
    },
    /** Sign-out: forget the value and make every running load stale. Returns the uid whose saved copy must be removed ('' if none). */
    forget(): string {
      gen += 1;
      const uid = value?.uid || lastUid;
      value = null;
      lastUid = '';
      return uid;
    },
  };
}
