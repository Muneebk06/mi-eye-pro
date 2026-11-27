import { useState } from 'react';
import { Screen, Role } from '../types';
import { SECTIONS, SHORTAGE, TREND, avg, pct, reportRows, heldPct, totalStudents } from '../data';
import Header from '../components/Header';

function TrendChart({ data }: { data: number[] }) {
  const W = 320, H = 160, L = 30, R = 8, T = 8, B = 26;
  const lo = 60, hi = 100;
  const x = (i: number) => L + (i * (W - L - R)) / (data.length - 1);
  const y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const path = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Attendance trend">
      {[60, 70, 80, 90, 100].map(v => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#E2E8F0" />
          <text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize="11" fill="#475569">{v}</text>
        </g>
      ))}
      <line x1={L} x2={W - R} y1={y(75)} y2={y(75)} stroke="#B45309" strokeWidth="1.5" strokeDasharray="4 3" />
      <path d={path} fill="none" stroke="#166534" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((v, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(v)} r="3" fill="#fff" stroke="#166534" strokeWidth="2" />
          <text x={x(i)} y={H - 7} textAnchor="middle" fontSize="11" fill="#475569">W{i + 1}</text>
        </g>
      ))}
    </svg>
  );
}

export default function AdminAnalytics({ navigate, role }: { navigate: (s: Screen) => void; role: Role }) {
  const [filter, setFilter] = useState('all');
  const [done, setDone] = useState(false);
  const keys = filter === 'all' ? SECTIONS : [filter];
  const trend = TREND[SECTIONS[0]].map((_, i) => avg(keys.map(k => TREND[k][i])));
  const rows = reportRows([]).filter(r => keys.includes(r.section));
  const below = SHORTAGE.filter(s => keys.includes(s.section)).sort((a, b) => pct(a) - pct(b));
  const stats = [
    { label: 'Overall attendance', value: `${avg(trend)}%` },
    role === 'director' ? { label: 'Classes held', value: `${heldPct(rows)}%` } : { label: 'Total students', value: String(totalStudents(keys)) },
    { label: 'Below threshold', value: String(below.length) },
  ];
  const exportCsv = () => {
    const csv = ['Name,Arid No.,Section,Course,Attendance %', ...below.map(s => `${s.name},${s.arid},${s.section},${s.code},${pct(s)}`)].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'attendance-analytics.csv';
    a.click();
    setDone(true);
  };

  return (
    <div className="pb-6">
      <Header title="Analytics" onBack={() => navigate(role === 'admin' ? 'adminPanel' : 'dashboard')} />
      <div className="px-4 pt-4 space-y-4">
        <select value={filter} onChange={e => setFilter(e.target.value)} className="field" aria-label="Section">
          <option value="all">All sections</option>
          {SECTIONS.map(s => <option key={s}>{s}</option>)}
        </select>

        <div className="grid grid-cols-3 gap-2">
          {stats.map(s => (
            <div key={s.label} className="card !p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-500 font-semibold mt-1 leading-tight">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-gray-900">Attendance trend</span>
            <span className="text-xs text-gray-500">Weekly %</span>
          </div>
          <TrendChart data={trend} />
          <div className="flex items-center gap-4 text-sm text-gray-600 mt-2"><span className="flex items-center gap-2"><span className="inline-block w-5 h-0.5 bg-[#166534]" />Weekly attendance %</span><span className="flex items-center gap-2"><span className="inline-block w-5 border-t-2 border-dashed border-[#B45309]" />75% threshold</span></div>
        </div>


        <button onClick={exportCsv} className="btn">Export</button>
        {done && <p className="text-xs text-center font-semibold" style={{ color: '#166534' }}>Export downloaded</p>}
      </div>
    </div>
  );
}
