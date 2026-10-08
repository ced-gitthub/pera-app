import Link from 'next/link';
import { requestReset } from '@/app/actions';
import { Flash, type SP } from '@/components/ui';
export default async function Page({ searchParams }: { searchParams: SP }) {
  return <main className="auth"><div><div className="brand"><span className="logo">₱</span>Pera</div><p className="tag">Reset your password</p><Flash sp={await searchParams} />
    <form action={requestReset} className="card grid gap-3"><p className="m">Enter your email and we'll send you a link to choose a new password.</p><input className="inp" name="email" type="email" placeholder="Email" required autoComplete="email" maxLength={254} /><button className="btn p">Send reset link</button></form>
    <p className="mt-3 m"><Link href="/login" className="underline">Back to log in</Link></p></div></main>;
}
