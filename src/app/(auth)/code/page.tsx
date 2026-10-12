import ZovixMark from '@/components/ZovixMark';
import Link from 'next/link';
import { sendLoginCode, verifyLoginCode } from '@/app/actions';
import { isEmail } from '@/lib/password';
import { Flash, type SP } from '@/components/ui';
export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams,
    email = isEmail(sp.email ?? '') ? sp.email! : '';
  return (
    <main className="auth">
      <div>
        <div className="brand">
          <ZovixMark />
          Zovix
        </div>
        <p className="tag">Log in with an email code</p>
        <Flash sp={sp} />
        {email ? (
          <form action={verifyLoginCode} className="card grid gap-3">
            <p className="m">
              Enter the code we emailed to <b className="em">{email}</b>.
            </p>
            <input type="hidden" name="email" value={email} />
            <input
              aria-label="Login code"
              className="inp"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Code from the email"
              required
              maxLength={12}
            />
            <button className="btn p">Log in</button>
          </form>
        ) : null}
        <form action={sendLoginCode} className="card grid gap-3">
          <p className="m">
            {email ? 'No email yet? Send a new code.' : 'Enter your email and we will send you a code. No password needed.'}
          </p>
          <input
            aria-label="Email"
            className="inp"
            name="email"
            type="email"
            placeholder="Email"
            defaultValue={email}
            required
            autoComplete="email"
            maxLength={254}
          />
          <button className="btn">{email ? 'Send a new code' : 'Email me a code'}</button>
        </form>
        <p className="mt-3 m">
          <Link href="/login" className="underline">
            Back to log in
          </Link>
        </p>
      </div>
    </main>
  );
}
