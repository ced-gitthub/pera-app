// "Create account" with an email that already has an account just signs that person in, so a new sign-up can land in an account that already has data.
// The app never deletes anything on its own: it ASKS. A truly new account has no rows, so nothing is asked.
export const JUST_SIGNED_UP_KEY = 'zv_just_signed_up';

export const EXISTING_DATA_TEXT =
  'This email already has data in Zovix (entries, budgets or goals from before). Nothing has been deleted. You can keep it, or start fresh and clear your records. Starting fresh asks you to type DELETE first.';

export function shouldAskAboutExistingData(
  justSignedUp: boolean,
  counts: { totalEntries: number; budgetsCount: number; goalsCount: number } | null,
): boolean {
  if (!justSignedUp || !counts) return false;
  return counts.totalEntries + counts.budgetsCount + counts.goalsCount > 0;
}
