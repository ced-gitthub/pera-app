import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { updatePassword } from '@/app/actions';
import { Flash, type SP } from '@/components/ui';
export default async function Page({ searchParams }: { searchParams: SP }) {
  const sb = await supabaseServer(), { data: { user } } = await sb.auth.getUser(); if (!user) redirect('/forgot?err=' + encodeURIComponent('That link is invalid or has expired. Request a new one.'));
  return <main className="auth"><div><div className="brand"><span className="logo">₱</span>Pera</div><p className="tag">Choose a new password</p><Flash sp={await searchParams} />
    <form action={updatePassword} className="card grid gap-3"><input className="inp" name="password" type="password" placeholder="New password (min 6)" required minLength={6} maxLength={72} autoComplete="new-password" /><input className="inp" name="confirm" type="password" placeholder="Repeat new password" required minLength={6} maxLength={72} autoComplete="new-password" /><button className="btn p">Save new password</button></form></div></main>;
}
