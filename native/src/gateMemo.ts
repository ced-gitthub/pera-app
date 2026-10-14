// The Gate's last data and tab, kept in memory so a theme change (which redraws the whole app) does not send the person back to Home behind a loading screen.
// Cleared on sign-out so the next account never sees it.
export function createGateMemo<T>() {
  let value: T | null = null;
  return { get: (): T | null => value, set: (v: T) => void (value = v), clear: () => void (value = null) };
}
