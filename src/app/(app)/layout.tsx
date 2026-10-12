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
