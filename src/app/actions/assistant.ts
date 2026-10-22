'use server';
import { ctx } from '@/lib/data/data';
import { manilaToday, formatMinor } from '@/core/money';
import { totals, type Tx } from '@/core/aggregate';
import { getProvider } from '@/ai/provider';
import { parseQuestion } from '@/lib/data/assistant';
import { safeMessage } from '@/lib/common/safe';
import { periodFor, shiftYm, monthRange } from '@/lib/data/range';

// ---- assistant: fixed read-only queries -> numbers computed by SQL -> text. A provider (if any) may only reword the numbers.
export async function askAssistant(q: string): Promise<{ ok: boolean; answer: string }> {
  try {
    const { sb, accounts, categories } = await ctx(true);
    const Q = parseQuestion(q.slice(0, 300), { categories, accounts, today: manilaToday() });
    const scope = `${Q.categoryName ? ' on ' + Q.categoryName : ''}${Q.accountName ? ' through ' + Q.accountName : ''}`;
    const must = <T>(r: { data: T; error: unknown }): T => {
      if (r.error) throw r.error;
      return r.data;
    }; // a failed query must never become a confident wrong number
    const sum = async (from: string, to: string) =>
      Number(
        must(await sb.rpc('sum_expense', { p_from: from, p_to: to, p_category: Q.categoryId ?? null, p_account: Q.accountId ?? null })) ??
          0,
      );
    const cn = new Map(categories.map((c) => [c.id, c.name]));
    let answer = 'I can answer spending, income, savings, top category, biggest expenses and month comparisons.';
    if (Q.kind === 'spend') answer = `You spent ${formatMinor(await sum(Q.from, Q.to))}${scope} ${Q.label}.`;
    else if (Q.kind === 'compare') {
      const p = periodFor2();
      const a = await sum(p.cur.from, p.cur.to),
        b = await sum(p.prev.from, p.prev.to);
      answer = `Spending${scope}: ${formatMinor(a)} this month vs ${formatMinor(b)} last month — ${formatMinor(Math.abs(a - b))} ${a >= b ? 'more' : 'less'}.`;
    } else if (Q.kind === 'income' || Q.kind === 'save' || Q.kind === 'top') {
      const data = must(await sb.rpc('period_summary', { p_from: Q.from, p_to: Q.to }));
      const txs: Tx[] = ((data as any[]) ?? []).map((x) => ({
        type: x.type,
        amount_minor: Number(x.total_minor),
        category: cn.get(x.category_id) ?? 'Other',
        date: Q.from,
      }));
      const t = totals(txs);
      if (Q.kind === 'income') answer = `Income ${Q.label}: ${formatMinor(t.income)}.`;
      else if (Q.kind === 'save')
        answer = `Income ${formatMinor(t.income)} − expenses ${formatMinor(t.expense)} = saved ${formatMinor(t.net)} ${Q.label}.`;
      else {
        const top = txs.filter((x) => x.type === 'expense').sort((a, b) => b.amount_minor - a.amount_minor)[0];
        answer = top ? `Top spending category ${Q.label}: ${top.category} at ${formatMinor(top.amount_minor)}.` : `No expenses ${Q.label}.`;
      }
    } else if (Q.kind === 'biggest') {
      const data = must(
        await sb
          .from('transactions')
          .select('amount_minor,description,transaction_date,category_id')
          .eq('type', 'expense')
          .gte('transaction_date', Q.from)
          .lte('transaction_date', Q.to)
          .order('amount_minor', { ascending: false })
          .limit(5),
      );
      answer = data?.length
        ? `Biggest expenses ${Q.label}: ` +
          data
            .map(
              (d: any) =>
                `${formatMinor(Number(d.amount_minor))} ${cn.get(d.category_id) ?? ''}${d.description ? ' (' + d.description + ')' : ''}`,
            )
            .join('; ')
        : `No expenses ${Q.label}.`;
    }
    const p = getProvider(process.env);
    if (p) {
      try {
        answer = (await p.answerFinancialQuestion(q, { computed_answer: answer })) || answer;
      } catch {
        /* keep the computed answer */
      }
    }
    return { ok: true, answer };
  } catch (e) {
    return { ok: false, answer: safeMessage(e, 'askAssistant') };
  }
}

function periodFor2() {
  const ym = manilaToday().slice(0, 7);
  return { cur: periodFor('month', manilaToday()), prev: monthRange(shiftYm(ym, -1)) };
}
