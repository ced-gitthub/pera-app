// Pure decisions for the Gate (no react-native), tested in tests/native-qa-fixes.test.ts.
export type Sheet = 'ask' | 'fresh' | 'choose' | 'end' | null;

/** Which sheet is open right now. At most ONE, in a fixed priority: the existing-data question first, then Start fresh, the tour choice, the Keep / Clear question.
 *  None while the tour or Make it yours is on screen. */
export function openSheet(s: { ask: boolean; fresh: boolean; choose: boolean; end: boolean; tour: boolean; mine: boolean }): Sheet {
  if (s.mine || s.tour) return null;
  if (s.ask) return 'ask';
  if (s.fresh) return 'fresh';
  if (s.choose) return 'choose';
  if (s.end) return 'end';
  return null;
}

/** Numbers each reload; an older reload that finishes after a newer one started must not overwrite it. */
export function createGeneration() {
  let n = 0;
  return { next: () => ++n, isStale: (token: number) => token !== n };
}
