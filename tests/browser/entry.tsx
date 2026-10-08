import { createRoot } from 'react-dom/client';
import QuickAdd from '@/components/QuickAdd';
const cats = [...['Salary', 'Freelance', 'Gift', 'Other Income'].map(name => ({ name, type: 'income' as const })), ...['Food', 'Groceries', 'Transportation', 'Shopping', 'Entertainment', 'Other'].map(name => ({ name, type: 'expense' as const }))];
createRoot(document.getElementById('root')!).render(<QuickAdd accounts={['Cash', 'GCash']} categories={cats} aiEnabled={false} />);
