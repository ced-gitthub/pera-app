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
export type Part = { text: string; what: string };
export type Sample = { you: string; parts: Part[]; result: string[] };
export const SAMPLES: Record<GateStep, Sample> = {
  first: {
    you: 'lunch 150 gcash',
    parts: [
      {
        text: 'lunch',
        what: 'What it was for. Zovix reads the word and picks a category (lunch becomes Food). A word it does not know goes to Other, and you can change it later.',
      },
      { text: '150', what: 'The amount in pesos. Just the number, no ₱ needed.' },
      {
        text: 'gcash',
        what: 'Which of your accounts it came from. It must match an account name on your Accounts page (GCash, Cash, BPI...). Leave it out and Zovix uses Cash.',
      },
    ],
    result: ['Saved as an expense: Food, ₱150.00', 'Your GCash balance goes down by ₱150', 'Your streak starts 🔥'],
  },
  balance: {
    you: 'GCash 1500 · Cash 300',
    parts: [
      {
        text: 'GCash',
        what: 'One of your accounts. Zovix already made some for you (Cash, GCash, Maya, BPI...), and you can add more later on the Accounts page.',
      },
      { text: '1500', what: 'How much is in it right now, as best you know.' },
    ],
    result: ['Your total balance shows ₱1,800.00', 'Every entry from now on adds to or takes from these'],
  },
  budget: {
    you: 'Food · ₱3,000 a month',
    parts: [
      { text: 'Food', what: 'A spending category. Anything you log as Food (like lunch) counts against this budget.' },
      { text: '₱3,000', what: 'The most you want to spend on it this month.' },
    ],
    result: ['After ₱1,200 of food spending it says ₱1,800 left', 'The bar turns red if you go over'],
  },
  goal: {
    you: 'New phone · ₱15,000',
    parts: [
      { text: 'New phone', what: 'Whatever you are saving for. Pick any name and icon.' },
      { text: '₱15,000', what: 'How much it costs. You can connect it to an account so its balance fills the bar.' },
    ],
    result: ['With ₱6,000 saved it shows 40%', '₱9,000 to go, and a 🎉 when you get there'],
  },
};
