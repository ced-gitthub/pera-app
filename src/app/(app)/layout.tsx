import Nav from '@/components/Nav';
import UndoBar from '@/components/UndoBar';
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <Nav />
      <main className="content">{children}</main>
      <UndoBar />
    </div>
  );
}
