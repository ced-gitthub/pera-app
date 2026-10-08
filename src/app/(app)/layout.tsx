import Nav from '@/components/Nav';
export default function AppLayout({ children }: { children: React.ReactNode }) { return <main className="max-w-4xl mx-auto p-3"><Nav />{children}</main>; }
