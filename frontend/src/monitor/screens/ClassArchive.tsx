import { useState } from 'react';
import { Screen, Role } from '../types';
import { useSwaps } from '../SwapContext';
import { sectionsFor, coursesFor, courseByCode, sessionsOf, ReportRow, roster, detectedCount, fmtDate, fmtTime, captureTime, TOTAL_CAPTURES, PRESENT_THRESHOLD } from '../data';
import Header from '../components/Header';
import { CaptureGrid } from '../components/Capture';
import { Icon } from '../components/Icons';
import { useSticky, matches, SearchBar, NoResults } from '../components/Search';

interface Props { navigate: (s: Screen) => void; role: Role; onMenu?: () => void }
type Status = 'Present' | 'Absent';
const STU_CHIPS = ['All', 'Present', 'Absent'] as const;
const nb = (s: string) => s.replace(/-/g, '\u2011');

export default function ClassArchive({ navigate, role, onMenu }: Props) {
  const { swaps } = useSwaps();
  const sections = sectionsFor(role);
  const [section, setSection] = useState(sections[0]);
  const [course, setCourse] = useState(coursesFor(role, sections[0])[0]);
  const [open, setOpen] = useState<ReportRow | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Status>>({});
  const canEdit = role === 'teacher';
  const [q, setQ] = useSticky('archive-q', '');
  const [chip, setChip] = useSticky<string>('archive-chip', 'All');
  const activeChip = STU_CHIPS.includes(chip as (typeof STU_CHIPS)[number]) ? chip : 'All';

  const courses = coursesFor(role, section);
  const statusOf = (sid: string, arid: string): Status =>
    overrides[sid + arid] ?? (detectedCount(sid, arid) >= PRESENT_THRESHOLD ? 'Present' : 'Absent');
  const presentOf = (r: ReportRow) => roster(r.section).filter(s => statusOf(r.id, s.arid) === 'Present').length;

  if (open) {
    const time = fmtTime(open.sched);
    const everyone = roster(open.section);
    const people = everyone.filter(p => {
      if (!matches(q, p.name, p.arid)) return false;
      const st = statusOf(open.id, p.arid);
      return activeChip === 'All' || st === activeChip;
    });
    return (
      <div className="pb-6">
        <Header title="Dated Lecture" onBack={() => setOpen(null)} />
        <div className="px-4 pt-4 space-y-4">
          <div className="card">
            <div className="text-sm font-bold text-gray-900">{open.code} · {courseByCode(open.code).name}</div>
            <div className="text-xs text-gray-500 mt-1">{fmtDate(open.iso)} · {time} · {open.section} · {open.venue}</div>
            <div className="text-xs text-gray-500">{open.teacher} · {presentOf(open)}/{everyone.length} present</div>
            {open.remark && <span className="tag tag-amber mt-2">{open.remark}</span>}
          </div>
          <div className="card">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="label !mb-0">Captures</span>
            </div>
            <CaptureGrid seed={open.id} indexes={Array.from({ length: TOTAL_CAPTURES }, (_, i) => i)} time={i => captureTime(time, i)} cols={5} />
          </div>
          <div className="card">
            <span className="label">Students</span>
            <SearchBar value={q} onChange={setQ} placeholder="Search name or Arid No." count={people.length} noun="student" />
            <div className="flex flex-wrap gap-2 mt-2 mb-2" role="group" aria-label="Status">
              {STU_CHIPS.map(c => (
                <button key={c} onClick={() => setChip(c)} aria-pressed={activeChip === c} className="min-h-11 px-3 rounded-full border text-xs font-semibold" style={{ background: activeChip === c ? '#166534' : '#fff', color: activeChip === c ? '#fff' : '#334155', borderColor: activeChip === c ? '#166534' : '#CBD5E1' }}>{c}</button>
              ))}
            </div>
            {people.length === 0 && <NoResults onClear={q || activeChip !== 'All' ? () => { setQ(''); setChip('All'); } : undefined} />}
            {people.map(p => {
              const st = statusOf(open.id, p.arid);
              return (
                <div key={p.arid} className="w-full min-h-16 py-2 flex items-center justify-between gap-2 border-t border-gray-100">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{p.name}</div>
                    <div className="text-xs text-gray-500 whitespace-nowrap">Arid No. {nb(p.arid)}</div>
                  </div>
                  {canEdit ? (
                    <button onClick={() => setOverrides(o => ({ ...o, [open.id + p.arid]: st === 'Present' ? 'Absent' : 'Present' }))} className={`min-h-11 px-3 rounded-lg border flex items-center gap-2 flex-shrink-0 text-xs font-semibold ${st === 'Present' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                      <span className={`w-5 h-5 rounded border flex items-center justify-center ${st === 'Present' ? 'bg-primary border-primary text-white' : 'bg-white border-red-300'}`}>
                        {st === 'Present' && <Icon name="check" size={14} />}
                      </span>
                      {st}
                    </button>
                  ) : <span className={`tag ${st === 'Present' ? 'tag-green' : 'tag-red'}`}>{st}</span>}
                </div>
              );
            })}
          </div>
          {!canEdit && <p className="text-xs text-gray-500 text-center">View only</p>}
        </div>
      </div>
    );
  }

  const sessions = sessionsOf(section, course, swaps);
  return (
    <div className="pb-6">
      <Header title="Class Archive" onBack={onMenu ? undefined : () => navigate('dashboard')} onMenu={onMenu} />
      <div className="px-4 pt-4 space-y-4">
        <div className="card grid grid-cols-2 gap-3">
          <div>
            <label className="label">Section</label>
            <select className="field" value={section} onChange={e => { setSection(e.target.value); setCourse(coursesFor(role, e.target.value)[0]); }}>
              {sections.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Course</label>
            <select className="field" value={course} onChange={e => setCourse(e.target.value)}>
              {courses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Previous lectures</h3>
        {sessions.length === 0 && <div className="card text-sm text-gray-500 text-center">No lectures yet.</div>}
        {sessions.map(r => (
          <button key={r.id} onClick={() => setOpen(r)} className="card w-full text-left flex items-center justify-between active:opacity-80">
            <div>
              <div className="text-sm font-bold text-gray-900">{fmtDate(r.iso)}</div>
              <div className="text-xs text-gray-500 mt-1">{fmtTime(r.sched)} · {r.venue}{r.remark ? ` · ${r.remark}` : ''}</div>
            </div>
            <span className="tag tag-green">{presentOf(r)}/{roster(r.section).length}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
