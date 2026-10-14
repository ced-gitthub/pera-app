// The live tour: a short list of steps. Each one switches to a real tab and points at a real control (a CoachTarget id, or the tab icon itself).
// tests/native-tour.test.ts checks that every tab id is a real tab in Tabs.tsx, every targetId is registered, and that the tour stays short (7 steps, 150 characters each).
export type TourStep = {
  tab: string;
  targetId: string;
  title: string;
  text: string;
  emptyText?: string; // shown instead of `text` while the pointed-at thing does not exist yet (an empty list)
};

export const TOUR: TourStep[] = [
  {
    tab: 'home',
    targetId: 'home:tiles',
    title: 'Home',
    text: 'This is Home: your Total, Spendable and Savings at a glance. Tap an account to open Accounts.',
  },
  { tab: 'home', targetId: 'fab', title: 'Add an entry', text: 'Tap ＋ Add to log money you spent or earned. It floats on every tab.' },
  {
    tab: 'activity',
    targetId: 'tab:activity',
    title: 'Activity',
    text: 'This is Activity, every entry newest first. Filter by Spent, Earned or Moved; tap one to edit or delete it (you can undo).',
  },
  {
    tab: 'accounts',
    targetId: 'tab:accounts',
    title: 'Accounts',
    text: 'This is Accounts, where your money lives. Use Manage to rename an account, set its balance or add one.',
  },
  {
    tab: 'budgets',
    targetId: 'tab:budgets',
    title: 'Budgets',
    text: 'This is Budgets, a monthly limit for each kind of spending. The bar fills as you spend.',
  },
  {
    tab: 'goals',
    targetId: 'tab:goals',
    title: 'Goals',
    text: 'This is Goals, things you are saving up for. A goal fills from a linked account or from your income minus expenses.',
  },
  {
    tab: 'more',
    targetId: 'tab:more',
    title: 'Settings',
    text: 'This is Settings: Personalize, Tools, Delete my records, Delete my account, and Help to replay this tour.',
  },
];
