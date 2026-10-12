import Ask from '@/components/Ask';
import PageBanner from '@/components/PageBanner';
export default function Assistant() {
  return (
    <>
      <PageBanner emoji="💬" title="Assistant" sub="Ask anything about your money" />
      <div className="card">
        <p className="m mb-3">
          Ask in plain words, like “How much did I spend on food this month?” or “Compare this month to last month.” Every number comes
          straight from your own entries, so it is never a guess.
        </p>
        <Ask />
      </div>
    </>
  );
}
