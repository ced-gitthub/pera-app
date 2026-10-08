import Link from 'next/link';
import { requestReset, requestResetViaBackup } from '@/app/actions';
import { backupConfigured } from '@/lib/backup';
import { Flash, type SP } from '@/components/ui';
export default async function Page({ searchParams }: { searchParams: SP }) {
  return <main className="auth"><div><div className="brand"><span className="logo">₱</span>Pera</div><p className="tag">Reset your password</p><Flash sp={await searchParams} />
    <form action={requestReset} className="card grid gap-3"><p className="m">Enter your email and we'll send you a link to choose a new password.</p><input className="inp" name="email" type="email" placeholder="Email" required autoComplete="email" maxLength={254} /><button className="btn p">Send reset link</button></form>
    {backupConfigured() && <details className="card"><summary>Can’t open that inbox?</summary><form action={requestResetViaBackup} className="grid gap-3" style={{ marginTop: 12 }}><p className="sub">Enter the backup email saved in your Pera security settings. We’ll send the reset link there.</p><input className="inp" name="email" type="email" placeholder="Backup email" required autoComplete="off" maxLength={254} /><button className="btn">Send link to backup email</button></form></details>}
    <p className="mt-3 m"><Link href="/login" className="underline">Back to log in</Link></p></div></main>;
}
