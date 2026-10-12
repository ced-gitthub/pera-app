import '@/components/goals.css'; // savings goals card
import '@/components/quests.css'; // styles for the dashboard quest board (imported here because the page is rendered in plain Node by the app tests)
import Nav from '@/components/Nav';
import UndoBar from '@/components/UndoBar';
import MarkReturning from '@/components/MarkReturning';
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <Nav />
      <main className="content">{children}</main>
      <UndoBar />
      <MarkReturning />
    </div>
  );
}
