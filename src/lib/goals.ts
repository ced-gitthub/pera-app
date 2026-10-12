import { parseAmountMinor } from '../core/money.ts';
// Savings goals: validation of the create form and the progress maths. Pure functions, unit-tested; money is integer centavos throughout.
export const GOAL_NAME_MAX = 40;
export const GOAL_EMOJIS = ['🎯', '📱', '💻', '🎒', '🎓', '✈️', '🏠', '🚲', '🎁', '🐷', '🩺', '🎮'];
export type GoalInput = { name: string; emoji: string; amount: string; account: string };
export type NewGoal = { name: string; emoji: string; target_minor: number; account_id: string | null };
export type GoalParse = { ok: true; goal: NewGoal } | { ok: false; message: string };
export function parseGoalForm(i: GoalInput, accountIds: string[]): GoalParse {
  const name = i.name.replace(/\s+/g, ' ').trim();
  if (!name) return { ok: false, message: 'Give your goal a name, like "New phone".' };
  if (name.length > GOAL_NAME_MAX) return { ok: false, message: `Keep the name to ${GOAL_NAME_MAX} characters or fewer.` };
  const target = parseAmountMinor(i.amount.trim());
  if (target === null) return { ok: false, message: 'Enter how much you want to save, like 5000 or 1,250.50.' };
  let account: string | null = null;
  if (i.account) {
    if (!accountIds.includes(i.account)) return { ok: false, message: 'Pick one of your own accounts, or leave it unconnected.' };
    account = i.account;
  }
  return {
    ok: true,
    goal: { name, emoji: GOAL_EMOJIS.includes(i.emoji) ? i.emoji : GOAL_EMOJIS[0], target_minor: target, account_id: account },
  };
}
// `have` is the connected account's balance, or income minus expenses since the goal started. A goal is reached only when have >= target.
export function goalProgress(target: number, have: number) {
  const h = Math.max(0, have),
    reached = h >= target;
  return { have: h, reached, pct: reached ? 100 : Math.floor((h * 100) / target), remaining: reached ? 0 : target - h };
}
