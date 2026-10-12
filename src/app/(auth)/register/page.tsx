import Link from 'next/link';
import { signUp } from '@/app/actions';
import AuthBrand from '@/components/AuthBrand';
import GoogleButton from '@/components/GoogleButton';
import { Flash, type SP } from '@/components/ui';
// Same joyful look as the welcome page: a headline that sells the first day, perks, a chunky yellow button, and a "ready for you" checklist (all true: the sign-up trigger seeds accounts and categories).
export default async function Page({ searchParams }: { searchParams: SP }) {
  return (
    <main className="auth">
      <div>
        <AuthBrand
          title="Start your streak today"
          tag="Free forever · takes 10 seconds"
          perks={[
            ['🔥', 'Daily streaks'],
            ['🎯', 'Savings goals'],
            ['⚡', 'Type it, done'],
          ]}
        />
        <GoogleButton />
        <Flash sp={await searchParams} />
        <form action={signUp} className="card grid gap-3">
          <input aria-label="Name" className="inp" name="name" placeholder="What should we call you?" maxLength={60} />
          <input aria-label="Email" className="inp" name="email" type="email" placeholder="Email" required autoComplete="email" />
          <input
            aria-label="Password (8+ characters)"
            className="inp"
            name="password"
            type="password"
            placeholder="Password (8+ characters)"
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
          />
          <button className="btn p">Create account · it's free</button>
        </form>
        <section className="auth-kit" aria-label="Ready for you on day one">
          <b>Ready for you on day one</b>
          <ul>
            <li>✅ 6 accounts set up: Cash, e-wallets, banks and more</li>
            <li>✅ 20 categories, so “lunch 150” files itself</li>
            <li>✅ Quest board and level 1 badge waiting</li>
          </ul>
        </section>
        <p className="mt-3 m">
          Have an account?{' '}
          <Link href="/login" className="underline">
            Log in
          </Link>
        </p>
        <p className="mt-3 m">
          <Link href="/privacy" className="underline">
            Privacy policy
          </Link>
        </p>
      </div>
    </main>
  );
}
