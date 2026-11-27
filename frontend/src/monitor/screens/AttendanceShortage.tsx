import { useState } from 'react';
import { Screen, Role } from '../types';
import { SHORTAGE, MIN_ATTENDANCE, pct, courseByCode, isOwn, SECTIONS } from '../data';
import Header from '../components/Header';
import { useSticky, matches, SearchBar, NoResults } from '../components/Search';

interface Props { navigate: (s: Screen) => void; role: Role; onMenu?: () => void }

export default function AttendanceShortage({ navigate, role, onMenu }: Props) {
  const [course, setCourse] = useState('all');
  const [section, setSection] = useState('all');
  const [q, setQ] = useSticky('shortage-q', '');
  const own = role === 'teacher';
  const base = SHORTAGE.filter(s => !own || isOwn(s.code));
  const courses = Array.from(new Set(base.map(s => s.code)));
  const list = base
    .filter(s => course === 'all' || s.code === course)
    .filter(s => section === 'all' || s.section === section)
    .filter(s => matches(q, s.name, s.arid))
    .sort((a, b) => pct(a) - pct(b));

  return (
    <div className="pb-6">
      <Header title="Attendance Shortage" onBack={onMenu ? undefined : () => navigate('dashboard')} onMenu={onMenu} />
      <div className="px-4 pt-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <select value={course} onChange={e => setCourse(e.target.value)} className="field">
            <option value="all">All courses</option>
            {courses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {own ? (
            <div className="field flex items-center text-gray-500">Min. {MIN_ATTENDANCE}%</div>
          ) : (
            <select value={section} onChange={e => setSection(e.target.value)} className="field">
              <option value="all">All sections</option>
              {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>
        <SearchBar value={q} onChange={setQ} placeholder="Search name or Arid No." count={list.length} noun="student" />

        {list.length === 0 && (q ? <NoResults onClear={() => setQ('')} /> : <div className="card text-sm text-gray-500 text-center">No students below the minimum.</div>)}
        {list.map(s => (
          <div key={s.arid + s.code} className="card">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-bold text-gray-900">{s.name}</div>
                <div className="text-xs text-gray-500 whitespace-nowrap">Arid No. {s.arid.replace(/-/g, '\u2011')}</div>
              </div>
              <span className="tag tag-red">{pct(s)}%</span>
            </div>
            <div className="text-xs text-gray-500 mt-2">{s.code} · {courseByCode(s.code).name} · {s.section}</div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
              <div className="h-full rounded-full" style={{ width: `${pct(s)}%`, background: '#B91C1C' }} />
            </div>
            <div className="text-xs text-gray-500 mt-3">{s.attended}/{s.total} classes</div>
          </div>
        ))}
      </div>
    </div>
  );
}
