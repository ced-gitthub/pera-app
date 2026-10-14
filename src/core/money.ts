// All money is an integer number of minor units (centavos). No floats in arithmetic.
export const MAX_MINOR = 99_999_999_999; // ₱999,999,999.99
export function parseAmountMinor(s: string, thousands = false): number | null {
  const parts = s.replace(/,/g, '').split('.');
  if (parts.length > 2) return null; // two decimal points (1.2.3) is a typo, not 1.20
  const [w, f = ''] = parts;
  if (!/^\d{1,11}$/.test(w) || !/^\d{0,2}$/.test(f)) return null;
  let m = Number(w) * 100 + Number((f + '00').slice(0, 2));
  if (thousands) m *= 1000;
  return m >= 1 && m <= MAX_MINOR ? m : null;
}
export function formatMinor(m: number): string {
  const a = Math.abs(m);
  return `${m < 0 ? '-' : ''}₱${Math.trunc(a / 100).toLocaleString('en-US')}.${String(a % 100).padStart(2, '0')}`;
}
export const isDate = (s: string) => {
  if (!/^\d{4}-\d\d-\d\d$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
// A real date that is also plausible for a money record: 2000-01-01 up to 5 years ahead. Catches typos like 2062 or 0001.
export const isSaneDate = (s: string, today = manilaToday()) =>
  isDate(s) && s >= '2000-01-01' && s <= `${Number(today.slice(0, 4)) + 5}-12-31`;
export const addDays = (s: string, n: number) => {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const dayOfWeek = (s: string) => new Date(s + 'T00:00:00Z').getUTCDay();
export const manilaToday = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(d);
