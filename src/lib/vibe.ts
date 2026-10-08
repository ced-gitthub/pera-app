import { addDays } from '../core/money';
const E: [RegExp, string][] = [[/food|dining|restaurant|meal|eat/i, '🍜'], [/grocer/i, '🛒'], [/transport|commute|fuel|gas|ride/i, '🚌'], [/bill|utilit|electric|water|internet/i, '💡'], [/subscri/i, '📺'], [/shop/i, '🛍️'], [/health|medic/i, '💊'], [/educ|school|tuition/i, '📚'], [/entertain|fun|movie|game/i, '🎬'], [/rent|home|house/i, '🏠'], [/travel|trip/i, '✈️'], [/saving/i, '🐷'], [/salary|pay|wage/i, '💼'], [/freelance|business/i, '🧑‍💻'], [/gift/i, '🎁'], [/invest|dividend|interest/i, '📈']];
export const emojiFor = (name: string, type = 'expense') => E.find(([r]) => r.test(name))?.[1] ?? (type === 'income' ? '💰' : '🪙');
export const greetingFor = (hour: number) => (hour < 5 ? 'Still up' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
export const manilaHour = (d = new Date()) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: 'numeric', hour12: false }).format(d)) % 24;
// Consecutive days with at least one transaction, ending today (or yesterday, so the streak is still alive until the day ends).
export function streak(dates: string[], today: string) {
  const set = new Set(dates); let d = set.has(today) ? today : addDays(today, -1), n = 0;
  while (set.has(d) && n < 3650) { n++; d = addDays(d, -1); }
  const week = [6, 5, 4, 3, 2, 1, 0].map(i => { const x = addDays(today, -i); return { d: x, on: set.has(x) }; });
  return { n, loggedToday: set.has(today), week };
}
export const pulse = (tenths: number) => (tenths > 1000 ? 'Over budget. A lighter day tomorrow gets you back.' : tenths >= 800 ? 'Close to the limit. Spend carefully.' : tenths === 0 ? 'Nothing spent yet.' : 'On track. Nice work.');
export const cheer = (n: number, cat: string) => (n > 1 ? `Logged ${n} entries. Nice work!` : `Logged! Filed under ${cat}.`);
