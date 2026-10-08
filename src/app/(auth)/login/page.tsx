import Link from 'next/link';
import { signIn } from '@/app/actions';
import { Flash, type SP } from '@/components/ui';
export default async function Page({ searchParams }: { searchParams: SP }) {
  return <main className="max-w-sm mx-auto p-4"><h1 className="text-2xl font-semibold mb-3">Pera — Log in</h1><Flash sp={await searchParams} />
    <form action={signIn} className="card grid gap-3"><input className="inp" name="email" type="email" placeholder="Email" required autoComplete="email" /><input className="inp" name="password" type="password" placeholder="Password" required autoComplete="current-password" /><button className="btn p">Log in</button></form>
    <p className="mt-3 m">No account? <Link href="/register" className="underline">Register</Link></p></main>;
}
