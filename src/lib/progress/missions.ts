// "Getting started" missions: the guided first steps for a new user. Derived from real data (nothing is stored), so they can never be out of date.
export type MissionInput = {
  totalEntries: number;
  accounts: { opening_balance_minor: number }[];
  budgetsCount: number;
  goalsCount: number;
  streak: number;
};
export type Mission = { id: string; emoji: string; title: string; hint: string; cta: string; href: string; done: boolean; next: boolean };
export function buildMissions(i: MissionInput) {
  const base: Omit<Mission, 'next'>[] = [
    {
      id: 'first',
      emoji: '🪙',
      title: 'Log your first peso',
      hint: 'Type what you spent, like "lunch 150 gcash".',
      cta: 'Try it now',
      href: '#quick',
      done: i.totalEntries >= 1,
    },
    {
      id: 'balance',
      emoji: '👛',
      title: 'Set your real balances',
      hint: 'Tell Zovix how much is in each account today.',
      cta: 'Open Accounts',
      href: '/accounts',
      done: i.accounts.some((a) => a.opening_balance_minor !== 0),
    },
    {
      id: 'budget',
      emoji: '🎯',
      title: 'Set a budget',
      hint: 'Pick a category and a monthly limit, so you know what is left.',
      cta: 'Open Budgets',
      href: '/budgets',
      done: i.budgetsCount >= 1,
    },
    {
      id: 'goal',
      emoji: '🏆',
      title: 'Start a savings goal',
      hint: 'A new phone, an emergency fund, anything you want.',
      cta: 'Add a goal',
      href: '#goals',
      done: i.goalsCount >= 1,
    },
    {
      id: 'streak',
      emoji: '🔥',
      title: 'Reach a 3-day streak',
      hint: 'Log something three days in a row.',
      cta: 'Log today',
      href: '#quick',
      done: i.streak >= 3,
    },
  ];
  const next = base.find((m) => !m.done)?.id ?? null,
    missions: Mission[] = base.map((m) => ({ ...m, next: m.id === next })),
    doneCount = missions.filter((m) => m.done).length;
  return { missions, doneCount, next, complete: next === null };
}
