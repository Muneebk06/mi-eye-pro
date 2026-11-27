import { useState } from 'react';
import { Screen, Role } from '../types';
import { DAYS, DAY_FULL, SECTIONS, STUDENT, TODAY, addDays, courseByCode, dayOf, fmtDate, fmtTime, isOwn, isWeekday, nextWeekday, scheduleOn } from '../data';
import { useSwaps } from '../SwapContext';
import Header from '../components/Header';

interface Props { navigate: (s: Screen) => void; role: Role; onMenu?: () => void }

const mondayOf = (iso: string) => addDays(iso, -DAYS.indexOf(dayOf(iso)));

export default function Timetable({ navigate, role, onMenu }: Props) {
  const { swaps } = useSwaps();
  const [date, setDate] = useState(isWeekday(TODAY) ? TODAY : nextWeekday(TODAY));
  const [section, setSection] = useState('all');
  const wide = role === 'admin' || role === 'director';
  const monday = mondayOf(date);
  const week = DAYS.map((_, i) => addDays(monday, i));

  const slots = scheduleOn(date, swaps)
    .filter(s => role === 'teacher' ? isOwn(s.code) : role === 'student' ? s.section === STUDENT.section : section === 'all' || s.section === section);

  const shift = (n: number) => setDate(addDays(date, n * 7));

  return (
    <div className="pb-6">
      <Header title="Timetable" onBack={onMenu ? undefined : () => navigate('dashboard')} onMenu={onMenu} />
      <div className="bg-white border-b border-gray-200 px-4 pt-2 pb-2">
        <div className="flex items-center justify-between">
          <button onClick={() => shift(-1)} aria-label="Previous week" className="w-11 h-11 flex items-center justify-center text-gray-600 active:opacity-60">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <span className="text-xs font-bold text-gray-600">{fmtDate(week[0])} – {fmtDate(week[4])}</span>
          <button onClick={() => shift(1)} aria-label="Next week" className="w-11 h-11 flex items-center justify-center text-gray-600 active:opacity-60">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {week.map((iso, i) => {
            const on = iso === date;
            return (
              <button key={iso} onClick={() => setDate(iso)} className="min-h-12 rounded-lg flex flex-col items-center justify-center" style={{ background: on ? '#166534' : 'transparent', color: on ? '#fff' : '#64748B' }}>
                <span className="text-xs" style={{ fontWeight: on ? 700 : 500 }}>{DAYS[i]}</span>
                <span className="text-xs">{Number(iso.slice(8))}{iso === TODAY ? ' •' : ''}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-gray-900">{DAY_FULL[dayOf(date)]}, {fmtDate(date)}</div>
            <div className="text-xs text-gray-500">
              {role === 'teacher' ? 'Your classes' : role === 'student' ? STUDENT.section : 'Read-only'} · swaps apply to this date only
            </div>
          </div>
          {wide && (
            <select value={section} onChange={e => setSection(e.target.value)} className="field !w-auto !min-h-11">
              <option value="all">All sections</option>
              {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>

        {slots.length === 0 && <div className="card text-sm text-gray-500 text-center">No classes scheduled.</div>}
        {slots.map(s => (
          <div key={s.id} className="card flex gap-3">
            <div className="w-1 rounded-full self-stretch" style={{ background: s.swapped ? '#D97706' : '#166534' }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs text-gray-500 font-semibold">{fmtTime(s.start)} – {fmtTime(s.end)}</div>
                <div className="flex gap-1.5">
                  {s.swapped && <span className="tag tag-amber">Swapped</span>}
                  {s.online && <span className="tag tag-blue">Online</span>}
                </div>
              </div>
              <div className="text-sm font-bold text-gray-900 mt-1">{s.code} · {courseByCode(s.code).name}</div>
              <div className="text-xs text-gray-500 mt-1">{s.teacher} · {s.venue}{role !== 'student' ? ` · ${s.section}` : ''}</div>
              {s.swapped && s.remark && <div className="text-xs text-amber-700 font-semibold mt-1">{s.remark}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
