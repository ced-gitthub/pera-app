const w = window as any; w.__calls = []; w.__fail = false;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
export async function saveItems(id: string, items: any[]) { w.__calls.push({ fn: 'save', id, items }); await sleep(300); if (w.__fail) return { ok: false, error: 'Not saved: simulated outage' }; return { ok: true, n: items.length }; }
export async function parseServer() { return []; }
export async function runCommand(t: string) { w.__calls.push({ fn: 'cmd', t }); return { ok: true, message: 'Deleted ₱120.00', deleted: { id: 'abc' } }; }
export async function restoreTx(row: any) { w.__calls.push({ fn: 'restore', row }); return { ok: true, message: 'Restored' }; }
