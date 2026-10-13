// Words for the landing page. Worked samples come from onboardingCopy so the website and the app teach the same examples.
export const WHAT: [string, string][] = [
  [
    'What it is',
    'Zovix is a free money tracker for Filipinos. You type what you spent or earned, like a text message, and it keeps the books.',
  ],
  [
    'How it helps',
    'You always know what is left in each wallet, where your pesos went this month, and whether you are still inside your budget.',
  ],
  ['What you gain', 'Fewer "saan napunta ang pera ko?" moments, a savings goal that fills as you go, and a streak that builds the habit.'],
];
export const HOW: [string, string, string][] = [
  ['1', 'Type it', 'Write "lunch 150 gcash". No forms, no spreadsheets, no bank login.'],
  ['2', 'Zovix sorts it', 'The amount, the category and the account are filled in for you, and the balance updates.'],
  ['3', 'Watch it add up', 'Budgets, goals, reports and quests show your progress. Every entry earns XP.'],
];
export const SAMPLE_TITLES = {
  first: 'Log an entry',
  balance: 'Set your balances',
  budget: 'Make a budget',
  goal: 'Start a savings goal',
} as const;
export const BENEFITS: [string, string, string][] = [
  ['⚡', 'Type it. Done.', 'Seconds per entry. Zovix understands pesos, cash, GCash, Maya and your banks.'],
  ['🎯', 'See where it goes', 'Spending by category, month by month, so you know what to cut and what to keep.'],
  ['🔔', 'Budgets that nudge', 'Set a monthly limit per category and see how much is left before it runs out.'],
  ['🏆', 'Goals that fill up', 'Save for a new phone or a trip. The bar moves with every peso you set aside.'],
  ['🔥', 'Streaks and quests', 'Daily and weekly quests, XP and levels make tracking a habit instead of a chore.'],
  ['🔒', 'Private and free', 'Only you can see your data. No ads, no tracking tools, no selling your information.'],
];
export const LEVELS: [string, string][] = [
  ['🪙', 'Broke Rookie'],
  ['🐷', 'Peso Pincher'],
  ['🎒', 'Budget Buddy'],
  ['⚔️', 'Wallet Warrior'],
  ['👑', 'Money Master'],
];
export const QUESTS = ['Log your first peso', 'Triple tap: log three entries in a day', 'Stay in budget', '5 of 7 days', '7-day streak'];
export const PRIVACY: string[] = [
  'Only you can see your money. Each account is locked to its owner in the database itself.',
  'No ads, no tracking or analytics tools, and your data is never sold or shared.',
  'Zovix never connects to your bank and never asks for your bank login.',
  'No access to your contacts, camera, microphone or location.',
  'You can delete your account and everything in it at any time.',
];
export const FAQ: [string, string][] = [
  ['Is Zovix really free?', 'Yes. It is free, with no ads and no paid tier.'],
  [
    'How do I install it on Android?',
    'Tap "Download for Android" and open the file when it finishes. If Android asks, allow installs from your browser, then tap Install. Open Zovix and sign in.',
  ],
  [
    'Is there an iPhone version?',
    'Not yet. On iPhone, open this page in Safari, tap Share, then Add to Home Screen. A full iPhone app needs Apple’s paid developer program, so it comes later.',
  ],
  ['Does it connect to my bank?', 'No. You type your entries yourself, so nothing is ever linked to your bank or e-wallet.'],
  ['What happens to my data?', 'It is stored securely, visible only to you, and never sold. Read the full privacy policy below.'],
  [
    'Why does Android warn me about the file?',
    'Apps installed outside the Play Store show that warning. It is normal for a file you downloaded yourself.',
  ],
];
