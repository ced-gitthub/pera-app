import Link from 'next/link';
import { signIn } from '@/app/actions';
import GoogleButton from '@/components/GoogleButton';
import { Flash, type SP } from '@/components/ui';
export default async function Page({ searchParams }: { searchParams: SP }) {
  return <main className="auth"><div><div className="brand"><span className="logo">₱</span>Pera</div><p className="tag">Welcome back · track every peso</p><Flash sp={await searchParams} /><GoogleButton />
    <form action={signIn} className="card grid gap-3"><input className="inp" name="email" type="email" placeholder="Email" required autoComplete="email" /><input className="inp" name="password" type="password" placeholder="Password" required autoComplete="current-password" /><button className="btn p">Log in</button></form>
    <p className="mt-3 m"><Link href="/forgot" className="underline">Forgot password?</Link></p>
    <p className="mt-3 m">No account? <Link href="/register" className="underline">Register</Link></p></div></main>;
}
