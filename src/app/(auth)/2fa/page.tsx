import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { verifyMfa, signOut } from '@/app/actions';
import { safeNext } from '@/lib/password';
import OtpField from '@/components/OtpField';
import { Flash, type SP } from '@/components/ui';
export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams, next = safeNext(sp.next), sb = await supabaseServer(), { data: { user } } = await sb.auth.getUser(); if (!user) redirect('/login');
  const { data: a } = await sb.auth.mfa.getAuthenticatorAssuranceLevel(); if (!(a?.nextLevel === 'aal2' && a.currentLevel !== 'aal2')) redirect(next);
  return <main className="auth"><div><div className="brand"><span className="logo">₱</span>Pera</div><p className="tag">Two-step verification</p><Flash sp={sp} />
    <form action={verifyMfa} className="card grid gap-3"><h1>Enter your code</h1><p className="sub">Open your authenticator app and type the 6-digit code for Pera.</p><input type="hidden" name="next" value={next} /><OtpField autoSubmit autoFocus label="6-digit code from your app" /><button className="btn p">Verify</button></form>
    <form action={signOut} className="mt-3"><button className="linkbtn" style={{ color: '#fff' }}>Log out</button></form></div></main>;
}
