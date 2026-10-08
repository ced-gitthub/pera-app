import Ask from '@/components/Ask';
import { getProvider } from '@/ai/provider';
export default function Assistant() {
  return <div className="card"><h1 className="text-xl font-semibold mb-1">Assistant</h1>
    <p className="m mb-3">Numbers are computed by the database for fixed question types (spending by period/category/account, income, savings, top category, biggest expenses, month comparison). {getProvider(process.env) ? 'An AI provider may reword the answer.' : 'No AI provider is configured; answers are plain text and the app works fully without one.'}</p><Ask /></div>;
}
