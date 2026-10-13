// The words of the tab tour. One slide per bottom tab; the ids match the tab bar in Tabs.tsx (a test checks it).
export type TourSlide = { id: string; emoji: string; title: string; text: string; example: string };

export const TOUR: TourSlide[] = [
  {
    id: 'home',
    emoji: '🏠',
    title: 'Home',
    text: 'Your money at a glance: what you can spend, what you have saved, and your accounts. The big ＋ Add button is how you record money in or out.',
    example: 'Bought lunch? Tap ＋ Add, type 150, pick Food, save.',
  },
  {
    id: 'activity',
    emoji: '🧾',
    title: 'Activity',
    text: 'Every entry you have saved, newest first. Tap one to edit it or delete it (you can undo right after). Use Filter to find things.',
    example: 'Tap Filter, choose Expenses and one account to see only that spending.',
  },
  {
    id: 'accounts',
    emoji: '👛',
    title: 'Accounts',
    text: 'Every place your money lives, with its balance. Tap an account to rename it or change its starting balance.',
    example: 'Tap Cash to fix its starting balance if it looks off.',
  },
  {
    id: 'budgets',
    emoji: '🎯',
    title: 'Budgets',
    text: 'A monthly limit for a spending type. The bar fills as you spend and turns amber near the limit. Tap a budget to change it.',
    example: 'Set Food to 5,000 a month and watch the bar.',
  },
  {
    id: 'goals',
    emoji: '🏆',
    title: 'Goals',
    text: 'Savings goals with a target. Add to a goal as you save and see how close you are. Tap a goal to edit it.',
    example: 'Goal: New phone, 20,000. Add 1,000 each payday.',
  },
  {
    id: 'more',
    emoji: '⚙️',
    title: 'Settings',
    text: 'Your name and the tools: reports, recurring entries, CSV import and export, and managing accounts and categories. To start fresh, use Delete data here (it asks you to type a word first). Help and this tour live here too.',
    example: 'Want to clear the sample data? Settings, then Delete data, then pick what to delete.',
  },
];
