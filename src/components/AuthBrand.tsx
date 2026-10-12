import ZovixMark from '@/components/ZovixMark';
// The top of every sign-in screen: brand, a friendly headline and (optionally) a row of perks, so these screens feel as joyful as the welcome page.
export default function AuthBrand({ title, tag, perks }: { title?: string; tag: string; perks?: [string, string][] }) {
  return (
    <>
      <div className="brand">
        <ZovixMark />
        Zovix
      </div>
      {title && <h1 className="auth-title">{title}</h1>}
      <p className="tag">{tag}</p>
      {perks && (
        <ul className="auth-perks" aria-label="What you get">
          {perks.map(([emoji, text]) => (
            <li key={text}>
              <span aria-hidden="true">{emoji}</span> {text}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
