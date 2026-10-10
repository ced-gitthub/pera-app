import { isCardName } from '@/core/parser';
import type { Account } from '@/lib/data';
import type { R } from '@/components/TxRow';
// Database rows -> what the lists draw. A transfer into a card account is flagged so it can be shown as a card payment (display only).
export function mapRows(data: any[], cn: Map<string, string>, accounts: Account[]): R[] {
  const an = new Map(accounts.map(a => [a.id, a]));
  return data.map(x => { const to = an.get(x.transfer_account_id); return { id: x.id, type: x.type, amount_minor: Number(x.amount_minor), date: x.transaction_date, description: x.description, category: cn.get(x.category_id) ?? '', account: an.get(x.account_id)?.name ?? '', to: to?.name ?? '', card: x.type === 'transfer' && !!to && isCardName(to.name, to.short_name) }; });
}
