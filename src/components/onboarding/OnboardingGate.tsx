import { cookies } from 'next/headers';
import { ctx, balanceMap } from '@/lib/data/data';
import { logErr } from '@/lib/common/safe';
import { gateFor, needsWizard, BAL_COOKIE, TOUR_COOKIE, ONBOARDING_COOKIE, WIZARD_COOKIE } from '@/lib/onboarding/onboarding';
import Quick from '@/components/entries/Quick';
import OnboardingShell, { MarkOnboarded } from '@/components/onboarding/OnboardingShell';
import TourView from '@/components/onboarding/TourView';
import OnboardingView from '@/components/onboarding/OnboardingView';
// The required first-run wizard, mounted once in the app layout so it covers every page. People who finished it carry a cookie and cost nothing here.
// If the counts cannot be read the wizard stays out of the way: a database hiccup must never lock someone out of their own money.
export default async function OnboardingGate() {
  const jar = await cookies(),
    onboarded = jar.has(ONBOARDING_COOKIE);
  if (onboarded) return null;
  const { sb, user, accounts, categories } = await ctx();
  if (!needsWizard(user.created_at)) return <MarkOnboarded />; // an account from before the wizard existed: never locked behind it
  const [te, bc, gc] = await Promise.all([
    sb.from('transactions').select('id', { count: 'exact', head: true }),
    sb.from('budgets').select('id', { count: 'exact', head: true }),
    sb.from('savings_goals').select('id', { count: 'exact', head: true }),
  ]);
  const bad = te.error ?? bc.error ?? gc.error;
  if (bad) {
    logErr('onboarding.gate', bad);
    return null;
  }
  const gate = gateFor(
    { totalEntries: te.count ?? 0, accounts, budgetsCount: bc.count ?? 0, goalsCount: gc.count ?? 0, streak: 0 },
    { onboarded, wizard: jar.has(WIZARD_COOKIE), balances: jar.has(BAL_COOKIE), toured: jar.has(TOUR_COOKIE) },
  );
  if (!gate.show) return gate.mark ? <MarkOnboarded /> : null;
  if (gate.step === 'tour')
    return (
      <OnboardingShell>
        <TourView />
      </OnboardingShell>
    );
  const bal = gate.step === 'balance' ? await balanceMap(sb) : new Map<string, number>(); // only that slide shows balances
  return (
    <OnboardingShell>
      <OnboardingView
        step={gate.step}
        number={gate.number}
        doneIds={gate.doneIds}
        accounts={accounts.map((a) => ({ ...a, current_minor: bal.get(a.id) ?? Number(a.opening_balance_minor) }))}
        categories={categories.filter((c) => c.type === 'expense')}
        quick={gate.step === 'first' ? <Quick /> : null}
      />
    </OnboardingShell>
  );
}
