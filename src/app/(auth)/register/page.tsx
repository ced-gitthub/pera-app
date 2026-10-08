import Link from 'next/link';
import { signUp } from '@/app/actions';
import GoogleButton from '@/components/GoogleButton';
import { Flash, type SP } from '@/components/ui';
export default async function Page({ searchParams }: { searchParams: SP }) {
  return <main className="auth"><div><div className="brand"><span className="logo">₱</span>Pera</div><p className="tag">Create your account · track every peso</p><Flash sp={await searchParams} /><GoogleButton />
    <form action={signUp} className="card grid gap-3"><input className="inp" name="name" placeholder="Name" maxLength={60} /><input className="inp" name="email" type="email" placeholder="Email" required autoComplete="email" /><input className="inp" name="password" type="password" placeholder="Password (8+ characters)" required minLength={8} maxLength={72} autoComplete="new-password" /><button className="btn p">Create account</button></form>
    <p className="mt-3 m">Have an account? <Link href="/login" className="underline">Log in</Link></p></div></main>;
}
