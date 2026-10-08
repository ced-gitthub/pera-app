'use client';
import { useState } from 'react';
import { importCsv } from '@/app/actions';
import { MAX_CSV_BYTES, MAX_CSV_LABEL } from '@/lib/limits';
export default function ImportForm() {
  const [err, setErr] = useState('');
  return <form action={importCsv} className="grid gap-2 mt-3" onSubmit={e => {
    const fd = new FormData(e.currentTarget), f = fd.get('file'), t = String(fd.get('csv') ?? '');
    if ((f instanceof File && f.size > MAX_CSV_BYTES) || new Blob([t]).size > MAX_CSV_BYTES) { e.preventDefault(); setErr(`That file is too large (max ${MAX_CSV_LABEL}). Split it into smaller files.`); } else setErr('');
  }}>
    <input type="file" name="file" accept=".csv,text/csv" aria-label="CSV file" />
    <textarea className="inp" name="csv" rows={4} placeholder="…or paste CSV here (date,type,amount,category,description,notes,account,to_account)" aria-label="Paste CSV" />
    <button className="btn p">Import</button>{err && <p className="flash bad" role="alert">{err}</p>}
  </form>;
}
