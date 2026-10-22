import '@/components/missions/missions.css'; // getting-started tutorial card
import '@/components/goals/goals.css'; // savings goals card
import '@/components/missions/quests.css'; // styles for the dashboard quest board (imported here because the page is rendered in plain Node by the app tests)
import '@/components/onboarding/onboarding.css'; // required first-run wizard
import Nav from '@/components/ui/Nav';
import UndoBar from '@/components/ui/UndoBar';
import MarkReturning from '@/components/auth/MarkReturning';
import OnboardingGate from '@/components/onboarding/OnboardingGate';
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="shell">
        <Nav />
        <main className="content">{children}</main>
        <UndoBar />
        <MarkReturning />
      </div>
      <OnboardingGate />
    </>
  );
}
