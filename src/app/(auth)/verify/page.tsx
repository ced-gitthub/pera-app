import Link from 'next/link';
import { resendVerification } from '@/app/actions';
import { isEmail } from '@/lib/password';
import { Flash, type SP } from '@/components/ui';
export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams, email = isEmail(sp.email ?? '') ? sp.email! : '';
  return <main className="auth"><div><div className="brand"><span className="logo">₱</span>Pera</div><p className="tag">{email ? 'One last step before you start' : 'Get a new confirmation link'}</p><Flash sp={sp} />
    {email ? <div className="card grid gap-3"><h1>Check your email</h1><p>We sent a confirmation link to <b className="em">{email}</b>. Open it on this device to finish creating your account.</p><p className="sub">Nothing there? Look in your spam folder, then resend.</p>
      <form action={resendVerification}><input type="hidden" name="email" value={email} /><button className="btn">Resend email</button></form></div>
      : <form action={resendVerification} className="card grid gap-3"><h1>Confirm your email</h1><input className="inp" name="email" type="email" placeholder="Email" required autoComplete="email" /><button className="btn p">Send a new link</button></form>}
    <p className="mt-3 m">Already confirmed? <Link href="/login" className="underline">Log in</Link></p></div></main>;
}
