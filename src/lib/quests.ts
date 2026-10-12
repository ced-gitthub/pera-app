import { addDays } from '../core/money.ts';
// Daily and weekly quests, XP and levels. Everything is DERIVED from transactions the user already logged (nothing extra is stored), so it can never disagree with their data.
export type QuestInput = {
  today: string; // Manila date, YYYY-MM-DD
  dates: string[]; // dates of recent entries (one item per entry), e.g. the last 60 days
  budgets: { spent: number; amount: number }[]; // this month's budgets in integer centavos
  totalEntries: number;
  streak: number;
};
export type Quest = {
  id: string;
  kind: 'daily' | 'weekly';
  emoji: string;
  title: string;
  hint: string;
  have: number;
  need: number;
  done: boolean;
};
export function daysLoggedLast7(dates: string[], today: string) {
  const win = new Set(Array.from({ length: 7 }, (_, i) => addDays(today, -i)));
  return new Set(dates.filter((d) => win.has(d))).size;
}
export function buildQuests(i: QuestInput): Quest[] {
  const todayN = i.dates.filter((d) => d === i.today).length,
    week = daysLoggedLast7(i.dates, i.today),
    out: Quest[] = [
      {
        id: 'first',
        kind: 'daily',
        emoji: '🪙',
        title: 'Log your first peso',
        hint: 'Add one entry today',
        have: Math.min(todayN, 1),
        need: 1,
        done: todayN >= 1,
      },
      {
        id: 'three',
        kind: 'daily',
        emoji: '⚡',
        title: 'Triple tap',
        hint: 'Log 3 things today',
        have: Math.min(todayN, 3),
        need: 3,
        done: todayN >= 3,
      },
    ];
  if (i.budgets.length > 0) {
    const ok = i.budgets.filter((b) => b.spent <= b.amount).length; // spending exactly the budget is not over it
    out.push({
      id: 'budget',
      kind: 'daily',
      emoji: '🛡️',
      title: 'Stay in budget',
      hint: 'Never go over a budget',
      have: ok,
      need: i.budgets.length,

      done: ok === i.budgets.length,
    });
  }
  out.push(
    {
      id: 'five',
      kind: 'weekly',
      emoji: '📅',
      title: '5 of 7 days',
      hint: 'Log on 5 of the last 7 days',
      have: Math.min(week, 5),
      need: 5,
      done: week >= 5,
    },
    {
      id: 'seven',
      kind: 'weekly',
      emoji: '🔥',
      title: '7-day streak',
      hint: 'Log 7 days in a row',
      have: Math.min(i.streak, 7),
      need: 7,
      done: i.streak >= 7,
    },
  );
  return out;
}
export const xpFor = (i: { totalEntries: number; streak: number }) =>
  Math.min(Math.max(0, i.totalEntries), 5000) * 5 + Math.min(Math.max(0, i.streak), 365) * 10;
const LEVELS: [number, string, string][] = [
  [0, 'Broke Rookie', '🪙'],
  [100, 'Peso Pincher', '🐷'],
  [300, 'Budget Buddy', '🎒'],
  [700, 'Wallet Warrior', '⚔️'],
  [1500, 'Money Master', '👑'],
];
export function levelInfo(xp: number) {
  let idx = 0;
  for (let k = 0; k < LEVELS.length; k++) if (xp >= LEVELS[k][0]) idx = k;
  const from = LEVELS[idx][0],
    next = LEVELS[idx + 1],
    to = next ? next[0] : null;
  return {
    level: idx + 1,
    title: LEVELS[idx][1],
    emoji: LEVELS[idx][2],
    xp,
    from,
    to,
    pct: to === null ? 100 : Math.round(((xp - from) * 100) / (to - from)),
    toNext: to === null ? 0 : to - xp,
    nextTitle: next ? next[1] : null,
  };
}
const TIPS = [
  'Skip one milk tea today and that is about ₱120 kept.',
  'Pack baon twice this week and watch the Food bar shrink.',
  'Wait 24 hours before any online purchase over ₱500.',
  'Pay yourself first: move a little to savings the day money arrives.',
  'Split the fare or the ride: shared costs hurt less.',
  'Check Reports on Sunday: one minute shows where the week went.',
  'Cheap and free counts: log it anyway, the streak does not care about the amount.',
  'Set a budget for just ONE category you overspend on. Start small.',
  'Cancel one subscription you forgot about.',
  'Buy the generic. Your wallet will not notice, your balance will.',
];
export function tipFor(today: string) {
  const n = today.split('-').reduce((a, p) => a * 31 + Number(p), 7);
  return TIPS[Math.abs(n) % TIPS.length];
}
