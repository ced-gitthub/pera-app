import Link from 'next/link';
import { signUp } from '@/app/actions';
import { Flash, type SP } from '@/components/ui';
export default async function Page({ searchParams }: { searchParams: SP }) {
  return <main className="max-w-sm mx-auto p-4"><h1 className="text-2xl font-semibold mb-3">Pera — Create account</h1><Flash sp={await searchParams} />
    <form action={signUp} className="card grid gap-3"><input className="inp" name="name" placeholder="Name" maxLength={60} /><input className="inp" name="email" type="email" placeholder="Email" required autoComplete="email" /><input className="inp" name="password" type="password" placeholder="Password (min 6)" required minLength={6} autoComplete="new-password" /><button className="btn p">Create account</button></form>
    <p className="mt-3 m">Have an account? <Link href="/login" className="underline">Log in</Link></p></main>;
}
