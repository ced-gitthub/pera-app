// The words of the tab tour. One slide per bottom tab; the ids match the tab bar in Tabs.tsx (a test checks it).
// Every claim here describes a control that exists in the app; tests/native-tour.test.ts checks the ones it can.
export type TourSlide = { id: string; emoji: string; title: string; text: string; example: string };

export const TOUR: TourSlide[] = [
  {
    id: 'home',
    emoji: '🏠',
    title: 'Home',
    text: 'Your money at a glance: a Total balance card, then tiles for Spendable, Savings and two of your accounts. Tap a tile to open Accounts. The floating ＋ Add button is how you record money in or out.',
    example: 'Bought lunch? Tap ＋ Add, type 150, pick Food, save.',
  },
  {
    id: 'activity',
    emoji: '🧾',
    title: 'Activity',
    text: 'Your latest entries, newest first. Tap one to edit it or delete it (you can undo right after). Filter, top right, narrows the list by Spent, Earned or Moved and by account.',
    example: 'Tap Filter, choose Spent and one account to see only that spending.',
  },
  {
    id: 'accounts',
    emoji: '👛',
    title: 'Accounts',
    text: 'Every place your money lives, with its balance. Tap an account to mark it as savings or choose whether it shows on Home. To rename an account or change its starting balance, use Manage at the top right.',
    example: 'Cash balance looks off? Tap Manage, open Cash and fix its starting balance.',
  },
  {
    id: 'budgets',
    emoji: '🎯',
    title: 'Budgets',
    text: 'A monthly limit for a spending type. The bar fills as you spend and changes colour near the limit. Tap a budget to change or delete it, or tap New budget, top right, to add one.',
    example: 'Set Food to 5,000 a month and watch the bar.',
  },
  {
    id: 'goals',
    emoji: '🏆',
    title: 'Goals',
    text: 'Savings goals with a target. A goal fills by itself: with a linked account it follows that account balance, and without one it counts your income minus expenses since the goal started. Tap a goal to change or delete it.',
    example: 'Goal: New phone, 20,000, linked to Savings. Move 1,000 into Savings each payday and the goal fills up.',
  },
  {
    id: 'more',
    emoji: '⚙️',
    title: 'Settings',
    text: 'Your name and the tools: reports, recurring entries, CSV import and export, and accounts and categories. Under Your data, Delete data removes ALL of your entries, budgets or goals, real ones too, after you type DELETE. Help and this tour live here too.',
    example:
      'Starting fresh after the tutorial? Settings, then Delete data, pick what to delete and type DELETE. It removes everything of that kind, not just the samples.',
  },
];
