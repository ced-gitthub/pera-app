import { ctx } from '@/lib/data';
import { toCsv, type Row } from '@/core/io';
export async function GET() {
  const { sb, accounts, categories } = await ctx(), an = new Map(accounts.map(a => [a.id, a.name])), cn = new Map(categories.map(c => [c.id, c.name])), rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('transactions').select('type,amount_minor,transaction_date,description,notes,category_id,account_id,transfer_account_id').order('transaction_date').order('created_at').range(from, from + 999);
    if (error) return new Response('Export failed: ' + error.message, { status: 500 });
    for (const x of data) rows.push({ date: x.transaction_date, type: x.type, amount_minor: Number(x.amount_minor), category: x.type === 'transfer' ? 'Transfer' : cn.get(x.category_id) ?? 'Other', description: x.description, notes: x.notes, account: an.get(x.account_id) ?? '', to_account: an.get(x.transfer_account_id) ?? '' });
    if (data.length < 1000) break;
  }
  return new Response(toCsv(rows), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="pera-export.csv"' } });
}
