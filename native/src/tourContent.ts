// The live tour: a list of steps. Each one switches to a real tab and points at a real control (a CoachTarget id, or the tab icon itself).
// tests/native-tour.test.ts checks that every tab id is a real tab in Tabs.tsx and every targetId is registered by a CoachTarget in the source.
export type TourStep = {
  tab: string;
  targetId: string;
  title: string;
  text: string;
  emptyText?: string; // shown instead of `text` while the pointed-at thing does not exist yet (an empty list)
};

export const TOUR: TourStep[] = [
  { tab: 'home', targetId: 'tab:home', title: 'Home', text: 'This is Home, your money at a glance. Tap this tab any time to come back.' },
  { tab: 'home', targetId: 'home:total', title: 'Total balance', text: 'All your accounts added up, minus what you owe.' },
  {
    tab: 'home',
    targetId: 'home:tiles',
    title: 'Spendable, Savings and accounts',
    text: 'Spendable, Savings and your first accounts. Tap one to open Accounts.',
  },
  {
    tab: 'home',
    targetId: 'fab',
    title: 'Add an entry',
    text: 'The ＋ Add button records money you spent or earned. It floats here on every tab.',
  },
  {
    tab: 'home',
    targetId: 'home:recent',
    title: 'Recent',
    text: 'Your latest entries. Tap any of them to edit or delete it.',
    emptyText: 'Your entries will appear here. Tap ＋ Add to log your first one.',
  },
  { tab: 'activity', targetId: 'tab:activity', title: 'Activity', text: 'This is Activity, every entry you have made, newest first.' },
  {
    tab: 'activity',
    targetId: 'activity:filter',
    title: 'Filter',
    text: 'Filter narrows the list by Spent, Earned or Moved, and by account.',
  },
  {
    tab: 'activity',
    targetId: 'activity:rows',
    title: 'Your entries',
    text: 'Tap any entry to edit or delete it. You can undo a delete right after.',
    emptyText: 'Your entries will appear here. Tap any entry to edit or delete it.',
  },
  { tab: 'activity', targetId: 'fab', title: 'Add entry', text: 'Add entry logs money in or out from this tab too.' },
  { tab: 'accounts', targetId: 'tab:accounts', title: 'Accounts', text: 'This is Accounts, every place your money lives.' },
  { tab: 'accounts', targetId: 'accounts:stats', title: 'Your totals', text: 'Spendable, Savings, Total and the debt already included.' },
  {
    tab: 'accounts',
    targetId: 'accounts:manage',
    title: 'Manage',
    text: 'Manage is where you rename an account, change its starting balance or add a new one.',
  },
  {
    tab: 'accounts',
    targetId: 'accounts:rows',
    title: 'An account',
    text: 'Tap an account to choose whether it is savings and whether it shows on Home.',
    emptyText: 'Your accounts will appear here. Tap ＋ Add account to create the first one.',
  },
  { tab: 'budgets', targetId: 'tab:budgets', title: 'Budgets', text: 'This is Budgets, a monthly limit for each kind of spending.' },
  {
    tab: 'budgets',
    targetId: 'budgets:card',
    title: 'A budget',
    text: 'The bar fills as you spend. Tap a budget to change or delete it.',
    emptyText: 'Your budgets will appear here. Tap ＋ New budget to set a limit.',
  },
  { tab: 'budgets', targetId: 'fab', title: 'New budget', text: 'Tap ＋ New budget to set a monthly limit.' },
  { tab: 'goals', targetId: 'tab:goals', title: 'Goals', text: 'This is Goals, things you are saving up for.' },
  {
    tab: 'goals',
    targetId: 'goals:card',
    title: 'A goal',
    text: 'A goal fills by itself from a linked account, or from your income minus expenses. Tap it to change or delete it.',
    emptyText: 'Your goals will appear here. Tap ＋ New goal: a phone, an emergency fund, anything.',
  },
  { tab: 'goals', targetId: 'fab', title: 'New goal', text: 'Tap ＋ New goal to start saving for something.' },
  { tab: 'more', targetId: 'tab:more', title: 'Settings', text: 'This is Settings. Everything about you and your data lives here.' },
  {
    tab: 'more',
    targetId: 'settings:name',
    title: 'Your name',
    text: 'Set your name here. The Personalize card, with themes and your profile, is for making Zovix yours.',
  },
  {
    tab: 'more',
    targetId: 'settings:tools',
    title: 'Tools',
    text: 'Reports, Recurring entries, Accounts and categories, and Import and export CSV.',
  },
  {
    tab: 'more',
    targetId: 'settings:delete',
    title: 'Delete my records',
    text: 'Delete my records removes ALL of your entries, budgets or goals, real ones too, after you type DELETE. Your login stays.',
  },
  {
    tab: 'more',
    targetId: 'settings:delete-account',
    title: 'Delete my account',
    text: 'Delete my account removes your login and every record for good. It cannot be undone.',
  },
  {
    tab: 'more',
    targetId: 'settings:help',
    title: 'Help',
    text: 'Take this tour again or replay the first-run tutorial here whenever you like.',
  },
];
