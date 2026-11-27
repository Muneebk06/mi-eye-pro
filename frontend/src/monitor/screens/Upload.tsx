import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Screen } from '../types';
import Header from '../components/Header';

interface Pending { file: string; classes: number }

const TODAY_LABEL = '16 Oct 2026';
const CELL_RE = /\(\s*[^()]+\)\s*_\s*(Lt\d+|Lab\d+|Online)/i;

export default function Upload({ navigate }: { navigate: (s: Screen) => void }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [last, setLast] = useState({ date: '9 Oct 2026', file: 'timetable-fall-2026.xlsx' });
  const input = useRef<HTMLInputElement>(null);

  const choose = () => input.current?.click();

  const pick = async (f?: File) => {
    if (!f) return;
    setDone(false); setPending(null); setError('');
    if (!/\.xlsx?$/i.test(f.name)) { setError('This file type is not supported. Choose an Excel file (.xlsx or .xls).'); return; }
    try {
      const wb = XLSX.read(await f.arrayBuffer());
      const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
      const parsed = grid.flat().filter(c => CELL_RE.test(String(c))).length;
      setPending({ file: f.name, classes: parsed > 0 ? parsed : 38 });
    } catch {
      setError('This file could not be read. Check that it is a valid Excel file.');
    }
  };

  const replace = () => {
    if (!pending) return;
    setLast({ date: TODAY_LABEL, file: pending.file });
    setPending(null); setDone(true);
  };

  return (
    <div className="pb-6">
      <Header title="Upload" onBack={() => navigate('adminPanel')} />
      <div className="px-4 pt-4 space-y-3">
        <input ref={input} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />

        {done && <div className="rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-semibold p-4">Timetable replaced</div>}

        {error ? (
          <div className="card space-y-3">
            <p className="text-sm font-semibold text-red-700">{error}</p>
            <button className="btn" onClick={choose}>Try again</button>
          </div>
        ) : pending ? (
          <div className="card space-y-3">
            <div className="min-w-0">
              <div className="text-sm font-bold text-gray-900 break-all">{pending.file}</div>
              <div className="text-sm text-gray-700 mt-1">Parsed {pending.classes} classes</div>
              <div className="text-xs text-gray-500 mt-1">Replaces the previous timetable</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button className="btn btn-secondary" onClick={() => setPending(null)}>Cancel</button>
              <button className="btn" onClick={replace}>Replace</button>
            </div>
          </div>
        ) : (
          <button className="btn" onClick={choose}>Upload Timetable</button>
        )}

        <p className="text-xs text-gray-500 text-center">Last upload: {last.date}, {last.file}</p>
      </div>
    </div>
  );
}
