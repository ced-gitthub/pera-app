import { ctx, aliasMap, balanceMap } from '@/lib/data';
import { getProvider } from '@/ai/provider';
import QuickAdd from './QuickAdd';
export default async function Quick() {
  const { sb, accounts, categories } = await ctx(), bal = await balanceMap(sb);
  return <QuickAdd accounts={accounts.map(a => a.name)} aliases={aliasMap(accounts)} balances={Object.fromEntries(accounts.map(a => [a.name, bal.get(a.id) ?? 0]))} categories={categories.map(c => ({ name: c.name, type: c.type }))} aiEnabled={Boolean(getProvider(process.env))} />;
}
