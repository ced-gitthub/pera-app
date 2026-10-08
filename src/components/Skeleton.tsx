// Loading skeletons: same shapes and spacing as the real pages, so the layout does not jump when data arrives. Pure markup (no client JS).
type P = { w?: number | string; h?: number; r?: number; className?: string };
const Sk = ({ w = '100%', h = 14, r, className = '' }: P) => <span className={`sk ${className}`} style={{ width: w, height: h, borderRadius: r }} />;
const Box = ({ label, children }: { label: string; children: React.ReactNode }) => <div data-skeleton aria-busy="true" role="status" aria-label={label}><span className="sr">{label}</span><div aria-hidden="true">{children}</div></div>;
const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => <div className={`card ${className}`}>{children}</div>;
const Rows = ({ n, bar = false }: { n: number; bar?: boolean }) => <>{Array.from({ length: n }, (_, i) => <div key={i} className="skrow"><Sk w={42} h={42} r={14} className="flex-none" /><div className="skgrow"><div className="skbetween"><Sk w={`${42 + ((i * 17) % 30)}%`} /><Sk w={64} /></div>{bar ? <Sk h={12} r={99} /> : <Sk w="30%" h={11} />}</div></div>)}</>;
const Pills = () => <div className="pills" style={{ overflow: 'hidden' }}>{[92, 104, 88, 96].map((w, i) => <Sk key={i} w={w} h={40} r={999} className="flex-none" />)}</div>;
const Quick = () => <Card><Sk w="46%" h={22} /><div style={{ height: 12 }} /><Sk h={46} r={14} /></Card>;

export function DashboardSk() {
  return <Box label="Loading your dashboard">
    <section className="card hero"><Sk w="40%" h={14} className="w" /><div style={{ height: 14 }} /><Sk w="28%" h={12} className="w" /><div style={{ height: 8 }} /><Sk w="62%" h={44} r={14} className="w" /><div style={{ height: 14 }} /><div className="row"><Sk w={150} h={30} r={999} className="w" /><Sk w={190} h={30} r={999} className="w" /></div></section>
    <div className="log"><Sk w="50%" h={22} /><div style={{ height: 12 }} /><Sk h={46} r={14} /></div>
    <Card><Sk w="36%" h={20} /><div style={{ height: 14 }} /><Rows n={2} bar /></Card>
    <Pills />
    <div className="stats">{[0, 1, 2].map(i => <div key={i} className="stat"><Sk w="40%" h={12} /><div style={{ height: 8 }} /><Sk w="70%" h={24} /></div>)}</div>
    <Card><Sk w="44%" h={20} /><div style={{ height: 14 }} /><Rows n={3} bar /></Card>
    <Card><Sk w="26%" h={20} /><div style={{ height: 14 }} /><Rows n={4} /></Card>
  </Box>;
}
export function TransactionsSk() { return <Box label="Loading transactions"><Quick /><Card><div className="row"><Sk w="min(100%,220px)" h={46} r={14} /><Sk w={120} h={46} r={14} /><Sk w={120} h={46} r={14} /></div></Card><Card><Rows n={9} /></Card></Box>; }
export function AccountsSk() { return <Box label="Loading accounts"><Card><Sk w="52%" h={26} /><div style={{ height: 14 }} /><Rows n={6} /></Card><Card><div className="row"><Sk w={120} h={20} /><Sk w={160} h={46} r={14} /><Sk w={120} h={46} r={14} /></div></Card></Box>; }
export function BudgetsSk() { return <Box label="Loading budgets"><Card><div className="skbetween"><Sk w={44} h={44} r={999} /><Sk w="40%" h={24} /><Sk w={44} h={44} r={999} /></div><div style={{ height: 18 }} /><Rows n={6} bar /></Card></Box>; }
export function ReportsSk() { return <Box label="Loading reports"><Pills /><Card><Sk w="40%" h={24} /><div style={{ height: 10 }} /><Sk w="80%" /><div style={{ height: 8 }} /><Sk w="60%" /></Card><Card><Sk w="36%" h={20} /><div style={{ height: 14 }} /><Rows n={4} /></Card><Card><Sk w="40%" h={20} /><div style={{ height: 14 }} />{Array.from({ length: 6 }, (_, i) => <div key={i} style={{ marginBottom: 12 }}><Sk h={16} /></div>)}</Card></Box>; }
export function AssistantSk() { return <Box label="Loading assistant"><Card><Sk w="30%" h={26} /><div style={{ height: 14 }} /><Sk h={46} r={14} /><div style={{ height: 14 }} /><div className="row">{[140, 120, 160].map((w, i) => <Sk key={i} w={w} h={40} r={999} />)}</div></Card></Box>; }
export function FormPageSk({ label = 'Loading' }: { label?: string }) { return <Box label={label}>{[0, 1, 2, 3].map(i => <Card key={i}><Sk w="34%" h={20} /><div style={{ height: 14 }} /><Sk w="90%" /><div style={{ height: 10 }} /><Sk w="70%" /><div style={{ height: 16 }} /><Sk w={110} h={44} r={999} /></Card>)}</Box>; }
