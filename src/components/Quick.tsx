import { ctx } from '@/lib/data';
import { getProvider } from '@/ai/provider';
import QuickAdd from './QuickAdd';
export default async function Quick() {
  const { accounts, categories } = await ctx();
  return <QuickAdd accounts={accounts.map(a => a.name)} categories={categories.map(c => ({ name: c.name, type: c.type }))} aiEnabled={Boolean(getProvider(process.env))} />;
}
