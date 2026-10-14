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

/** The "this account already has data: keep it or start fresh?" question. total = entries + budgets + goals (null when the counts could not be read).
 *  Never lost: kept pending when the counts are unknown; cleared once the account is known to be empty (a sign-up into a new account, or after Start fresh). */
export function decideAsk(x: { wasSignUp: boolean; pending: boolean; total: number | null; fresh?: boolean; answered?: boolean }): {
  ask: boolean;
  write: 'clear' | null;
} {
  if (x.fresh || x.answered) return { ask: false, write: null }; // answered already, or Start fresh is open: a reload must not raise it again
  const pending = x.pending || x.wasSignUp;
  if (!pending) return { ask: false, write: null };
  if (x.total === null) return { ask: true, write: null };
  return x.total > 0 ? { ask: true, write: null } : { ask: false, write: 'clear' };
}

/**
 * "Seen" markers live on the phone, so a reinstall wipes them. An account that is already set up (nothing left to do except the example
 * walkthrough, or nothing at all) and was NOT just created is a returning user: no walkthrough, no "Make it yours", no tour question.
 * Decided once per app start; a real replay from Settings and a half-finished setup are never skipped.
 */
export function isReturningAccount(x: {
  wasSignUp: boolean;
  replaying: boolean;
  firstLoad: boolean;
  accountsCount: number;
  hasActivity?: boolean; // the account already has entries, budgets or goals
  gate: { show: boolean; step?: string };
}): boolean {
  if (x.wasSignUp || x.replaying || !x.firstLoad || x.accountsCount < 1) return false;
  // 'balance' only counts when the account clearly has history: all-zero opening balances look unfinished after a reinstall (the phone's balances flag is gone)
  return x.gate.show && (x.gate.step === 'tour' || (x.gate.step === 'balance' && !!x.hasActivity)); // never when nothing is shown: that is also what a failed read looks like, and a new user who left the tour question open
}
