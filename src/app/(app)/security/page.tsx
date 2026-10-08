import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { changePassword, disableMfa, signOutOthers, signOutEverywhere } from '@/app/actions';
import MfaSetup from '@/components/MfaSetup';
import OtpField from '@/components/OtpField';
import { Flash, type SP } from '@/components/ui';
export default async function Security({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams, sb = await supabaseServer(), { data: { user } } = await sb.auth.getUser(); if (!user) redirect('/login');
  const { data: f } = await sb.auth.mfa.listFactors(), on = !!f?.totp?.length;
  return <><Flash sp={sp} />
    <div className="card"><h1 className="text-xl font-semibold mb-2">Security</h1><p>{user.email} <span className={`badge ${user.email_confirmed_at ? 'on' : 'off'}`}>{user.email_confirmed_at ? 'Email confirmed' : 'Email not confirmed'}</span></p></div>
    <div className="card"><div className="row justify-between"><h2>Two-step verification</h2><span className={`badge ${on ? 'on' : 'off'}`}>{on ? 'On' : 'Off'}</span></div>
      {on ? <><p className="m" style={{ marginBottom: 12 }}>Pera asks for a code from your authenticator app each time you log in. Without the code, nobody can open your data, even with your password.</p>
        <form action={disableMfa} className="row"><OtpField label="6-digit code to turn off" /><button className="btn">Turn off</button></form></>
        : <><p className="m" style={{ marginBottom: 12 }}>Add a second lock. Even if someone learns your password, they cannot get in without the code from your phone.</p><MfaSetup /></>}</div>
    <div className="card"><h2>Change password</h2><form action={changePassword} className="grid gap-3"><input className="inp" name="current" type="password" placeholder="Current password" required autoComplete="current-password" maxLength={72} />
      <input className="inp" name="password" type="password" placeholder="New password (8+ characters)" required minLength={8} maxLength={72} autoComplete="new-password" /><input className="inp" name="confirm" type="password" placeholder="Repeat new password" required minLength={8} maxLength={72} autoComplete="new-password" />
      <div><button className="btn p">Change password</button></div><p className="m">Changing it logs out every other device.</p></form></div>
    <div className="card"><h2>Devices</h2><p className="m" style={{ marginBottom: 12 }}>Lost a phone or used a shared computer? Log those sessions out.</p>
      <div className="row"><form action={signOutOthers}><button className="btn">Log out other devices</button></form><form action={signOutEverywhere}><button className="btn">Log out everywhere</button></form></div></div></>;
}
