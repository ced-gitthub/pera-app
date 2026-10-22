// Gradient banner at the top of an in-app page: an emoji badge, the page title (the page's only h1) and one friendly line.
export default function PageBanner({ emoji, title, sub }: { emoji: string; title: string; sub: string }) {
  return (
    <div className="tabhead page-banner">
      <div className="th-title">
        <span className="th-emoji" aria-hidden="true">
          {emoji}
        </span>
        <div>
          <h1>{title}</h1>
          <p>{sub}</p>
        </div>
      </div>
    </div>
  );
}
