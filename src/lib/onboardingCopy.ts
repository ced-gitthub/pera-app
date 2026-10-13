import type { GateStep } from './onboarding.ts';
// Words for the first-run wizard and the tour: what to do on each step, plus a worked example (what you type -> what Zovix does).
export const COPY: Record<GateStep | 'finish', { emoji: string; label: string; title: string; todo: string[] }> = {
  first: {
    emoji: '🪙',
    label: 'First peso',
    title: 'Log your first peso',
    todo: ['Tap the glowing box below.', 'Type what you spent, like “lunch 150 gcash”.', 'Tap the button to save it.'],
  },
  balance: {
    emoji: '👛',
    label: 'Balances',
    title: 'How much do you have right now?',
    todo: ['Type what is in each account today.', 'Skip the ones that are empty. A rough number is fine.', 'Tap “Save balances”.'],
  },
  budget: {
    emoji: '🎯',
    label: 'Budget',
    title: 'Set your first budget',
    todo: ['Pick something you spend on.', 'Type the most you want to spend on it each month.', 'Tap “Set budget”.'],
  },
  goal: {
    emoji: '🏆',
    label: 'Goal',
    title: 'Start a savings goal',
    todo: ['Name what you are saving for.', 'Pick an icon and type how much it costs.', 'Tap “Add goal”.'],
  },
  finish: {
    emoji: '🎉',
    label: 'Done',
    title: 'You are all set!',
    todo: [],
  },
};
export type Sample = { you: string; result: string[] };
export const SAMPLES: Record<GateStep, Sample> = {
  first: {
    you: 'lunch 150 gcash',
    result: ['Saved as an expense: Food, ₱150.00', 'Your GCash balance goes down by ₱150', 'Your streak starts 🔥'],
  },
  balance: {
    you: 'GCash 1500 · Cash 300',
    result: ['Your total balance shows ₱1,800.00', 'Every entry from now on adds to or takes from these'],
  },
  budget: {
    you: 'Food · ₱3,000 a month',
    result: ['After ₱1,200 of food spending it says ₱1,800 left', 'The bar turns red if you go over'],
  },
  goal: {
    you: 'New phone · ₱15,000',
    result: ['With ₱6,000 saved it shows 40%', '₱9,000 to go, and a 🎉 when you get there'],
  },
};
