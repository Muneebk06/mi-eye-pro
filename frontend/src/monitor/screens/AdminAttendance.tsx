import { useLayoutEffect, useMemo, useState } from 'react';
import { Screen } from '../types';
import { COURSES, STUDENT_RECORDS, StudentRecord, courseByCode } from '../data';
import { RANGES, attScroll, attendanceOf, summarize } from '../attendanceData';
import Header from '../components/Header';
import Bar from '../components/Bar';
import { Icon } from '../components/Icons';
import { matches, FilterChips, FilterGroup, FilterSheet, FilterValues, NoResults, SearchBar, useSticky } from '../components/Search';

export const attGroups = (): FilterGroup[] => [
  { key: 'section', label: 'Section', options: [...new Set(STUDENT_RECORDS.map(s => s.section))] },
  { key: 'course', label: 'Course', options: COURSES.filter(c => c.venue !== 'Online').map(c => c.code) },
  { key: 'range', label: 'Date range', options: [...RANGES], allLabel: 'All dates' },
  { key: 'sort', label: 'Sort by', options: ['Name'], allLabel: 'Lowest first' },
];
const TOGGLES = [{ key: 'below', label: 'Below 75% only' }];

export const pctColor = (v: number) => (v >= 80 ? '#16A34A' : v >= 75 ? '#D97706' : '#B91C1C');

interface Props { navigate: (s: Screen) => void; onMenu: () => void; onOpenStudent: (arid: string) => void }

export default function AdminAttendance({ navigate: _n, onMenu, onOpenStudent }: Props) {
  const [q, setQ] = useSticky('att-q', '');
  const [f, setF] = useSticky<FilterValues>('att-f', {});
  const [open, setOpen] = useState(false);
  const groups = useMemo(attGroups, []);

  useLayoutEffect(() => {
    window.scrollTo(0, attScroll.restore ? attScroll.y : 0);
    attScroll.restore = false;
  }, []);

  const rows = useMemo(() => {
    const list = STUDENT_RECORDS
      .filter(s => (!f.section || s.section === f.section) && matches(q, s.name, s.arid))
      .map(s => ({ s, ...summarize(attendanceOf(s), f.course, f.range) }))
      .filter(r => r.total > 0);
    list.sort((a, b) => (f.sort === 'Name' ? a.s.name.localeCompare(b.s.name) || a.s.arid.localeCompare(b.s.arid) : a.pct - b.pct || a.s.name.localeCompare(b.s.name)));
    return list;
  }, [q, f]);
  const below = rows.filter(r => r.pct < 75).length;
  const shown = f.below ? rows.filter(r => r.pct < 75) : rows;
  const filterCount = groups.filter(g => f[g.key]).length + (f.below ? 1 : 0);
  const clear = () => { setF({}); setQ(''); };
  const open1 = (s: StudentRecord) => { attScroll.y = window.scrollY; onOpenStudent(s.arid); };

  return (
    <div className="pb-6">
      <Header title="Attendance" onMenu={onMenu} />
      <div className="px-4 pt-4 space-y-3">
        <SearchBar value={q} onChange={setQ} placeholder="Search name or Arid No." count={shown.length} summary={`${shown.length} ${shown.length === 1 ? 'student' : 'students'} · ${below} below 75%`} filterCount={filterCount} onFilters={() => setOpen(true)} />
        <div className="flex flex-wrap gap-2 empty:hidden">
          <FilterChips groups={groups} values={f} onRemove={k => setF({ ...f, [k]: '' })} />
          {f.below && <button onClick={() => setF({ ...f, below: '' })} className="tag tag-green !min-h-8 active:opacity-70" aria-label="Remove Below 75% filter">Below 75% only<Icon name="close" size={14} /></button>}
        </div>
        {shown.length === 0 ? <NoResults text="No students match your filters" onClear={clear} /> : shown.map(({ s, attended, total, pct }) => (
          <button key={s.arid} onClick={() => open1(s)} className="card w-full text-left active:opacity-80">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-green-100 text-primary font-bold flex items-center justify-center flex-shrink-0" aria-hidden="true">{s.name[0]}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-gray-900 truncate">{s.name}</div>
                <div className="text-xs text-gray-500 whitespace-nowrap">{s.arid} · {s.section}</div>
              </div>
              <div className="text-xl font-bold flex-shrink-0" style={{ color: pctColor(pct) }}>{pct}%</div>
            </div>
            <div className="mt-3"><Bar value={pct} /></div>
            <div className="text-xs text-gray-500 mt-2">{f.course ? `${courseByCode(f.course).short}: ` : ''}attended {attended} of {total} classes</div>
          </button>
        ))}
      </div>
      <FilterSheet open={open} groups={groups} toggles={TOGGLES} values={f} onApply={setF} onClose={() => setOpen(false)} />
    </div>
  );
}
