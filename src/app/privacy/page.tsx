import Link from 'next/link';

export const metadata = { title: 'Privacy policy — Zovix', description: 'What Zovix stores, who can see it, and how to delete it.' };

// Public page (no login needed): required by Google Play and the App Store. Keep it accurate when features change.
export default function Privacy() {
  return (
    <main className="card" style={{ maxWidth: 720, margin: '24px auto', lineHeight: 1.6 }}>
      <h1>Zovix privacy policy</h1>
      <p className="m">Last updated: 11 October 2026</p>

      <h2>What Zovix stores</h2>
      <p>
        Your email address and the name you choose, your password (stored only as a secure hash by our login provider, never readable), and
        the money information you type in: accounts, balances, transactions, categories, budgets, recurring rules and your screen layout. If
        you add a backup email, we store that address and a short-lived verification code (stored hashed).
      </p>

      <h2>What Zovix does not do</h2>
      <p>
        No advertising, no analytics or tracking tools, no selling or sharing your data, and no access to your contacts, camera, microphone,
        location or bank accounts. Zovix never connects to your bank.
      </p>

      <h2>Who processes your data</h2>
      <ul>
        <li>Supabase stores the database and handles login (servers in Sydney, Australia).</li>
        <li>Vercel hosts the app.</li>
        <li>Gmail (as the mail server used by Supabase and Zovix) sends confirmation, password reset and security emails.</li>
        <li>
          If you choose &quot;Sign in with Google&quot;, Google tells Zovix your email address and name. Zovix never sees your Google
          password.
        </li>
        <li>
          When you choose a password, only the first 5 characters of its fingerprint are sent to HaveIBeenPwned to check it was not leaked;
          your password itself is never sent.
        </li>
      </ul>

      <h2>Who can see your data</h2>
      <p>
        Only you. The database enforces this per user (row-level security), so one user cannot read another user&apos;s data. The app owner
        can technically access the database to keep the service running and does not look at individual users&apos; data.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Download everything: log in, then Settings, then Download CSV.</li>
        <li>
          Delete your account and all of its data permanently: log in, then{' '}
          <Link href="/security#delete-account">Security → Delete my account</Link>. This takes effect immediately and cannot be undone.
        </li>
        <li>
          Deleted transactions are kept in an undo area for a short time so you can restore them. Deleting your account removes that too.
        </li>
      </ul>

      <h2>Children</h2>
      <p>Zovix is not meant for children under 13, and we do not knowingly collect their data.</p>

      <h2>Contact and changes</h2>
      <p>
        Questions or requests: open an issue at{' '}
        <a href="https://github.com/ced-gitthub/pera-app/issues">github.com/ced-gitthub/pera-app/issues</a>. If this policy changes, the
        date above changes.
      </p>
    </main>
  );
}
