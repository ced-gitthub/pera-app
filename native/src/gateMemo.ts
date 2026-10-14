// The Gate's last data and tab, kept in memory so a theme change (which redraws the whole app) does not send the person back to Home behind a loading screen.
// Cleared on sign-out so the next account never sees it. An epoch makes a reload that STARTED before a sign-out unable to put the old account back.
export function createGateMemo<T>() {
  let value: T | null = null;
  let epoch = 0;
  return {
    get: (): T | null => value,
    /** Call when a reload starts; pass the token to set(). */
    begin: (): number => epoch,
    /** Stores the value only if no sign-out happened since begin(token). Without a token it always stores (tab changes). */
    set(v: T, token?: number): boolean {
      if (token !== undefined && token !== epoch) return false;
      value = v;
      return true;
    },
    clear() {
      epoch += 1;
      value = null;
    },
  };
}
