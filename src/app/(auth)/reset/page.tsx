import ZovixMark from '@/components/ui/ZovixMark';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { updatePassword } from '@/app/actions';
import { Flash, type SP } from '@/components/ui/ui';
export default async function Page({ searchParams }: { searchParams: SP }) {
  const sb = await supabaseServer(),
    {
      data: { user },
    } = await sb.auth.getUser();
  if (!user) redirect('/forgot?err=' + encodeURIComponent('That link is invalid or has expired. Request a new one.'));
  return (
    <main className="auth">
      <div>
        <div className="brand">
          <ZovixMark />
          Zovix
        </div>
        <p className="tag">Choose a new password</p>
        <Flash sp={await searchParams} />
        <form action={updatePassword} className="card grid gap-3">
          <input
            aria-label="New password (8+ characters)"
            className="inp"
            name="password"
            type="password"
            placeholder="New password (8+ characters)"
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
          />
          <input
            aria-label="Repeat new password"
            className="inp"
            name="confirm"
            type="password"
            placeholder="Repeat new password"
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
          />
          <button className="btn p">Save new password</button>
        </form>
      </div>
    </main>
  );
}
