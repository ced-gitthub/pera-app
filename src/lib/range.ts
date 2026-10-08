const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const isYm = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
export const monthRange = (ym: string) => { const [y, m] = ym.split('-').map(Number); return { from: `${ym}-01`, to: `${ym}-${String(lastDay(y, m)).padStart(2, '0')}` }; };
export const shiftYm = (ym: string, n: number) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };
export function periodFor(key: string, today: string, from?: string, to?: string) {
  const ym = today.slice(0, 7), y = Number(today.slice(0, 4));
  if (key === 'prev') return { ...monthRange(shiftYm(ym, -1)), label: 'Last month' };
  if (key === 'year') return { from: `${y}-01-01`, to: `${y}-12-31`, label: 'This year' };
  if (key === 'prevyear') return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31`, label: 'Last year' };
  if (key === 'custom' && from && to && /^\d{4}-\d\d-\d\d$/.test(from) && /^\d{4}-\d\d-\d\d$/.test(to) && from <= to) return { from, to, label: `${from} to ${to}` };
  return { ...monthRange(ym), label: 'This month' };
}
