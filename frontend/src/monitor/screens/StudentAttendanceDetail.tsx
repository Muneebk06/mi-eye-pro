import { useLayoutEffect } from 'react';
import { Screen } from '../types';
import { SECTION_COURSES, courseByCode, fmtDate, fmtTime, studentByArid, TOTAL_CAPTURES } from '../data';
import { RANGES, attScroll, attendanceOf, rangeStart, summarize } from '../attendanceData';
import { pctColor } from './AdminAttendance';
import Header from '../components/Header';
import Bar from '../components/Bar';
import { useSticky } from '../components/Search';

interface Props { navigate: (s: Screen) => void; arid: string | null }

export default function StudentAttendanceDetail({ navigate, arid }: Props) {
  const [course, setCourse] = useSticky(`sad-course-${arid}`, '');
  const [range, setRange] = useSticky(`sad-range-${arid}`, '');
  useLayoutEffect(() => { window.scrollTo(0, 0); }, [arid]);
  const back = () => { attScroll.restore = true; navigate('attendance'); };
  const s = arid ? studentByArid(arid) : undefined;
  if (!s) return <div><Header title="Student" onBack={back} /></div>;

  const all = attendanceOf(s);
  const overall = summarize(all);
  const courses = SECTION_COURSES[s.section].filter(c => all.some(a => a.code === c));
  const from = rangeStart(range);
  const history = all.filter(a => (!course || a.code === course) && (!from || a.iso >= from));

  return (
    <div className="pb-6">
      <Header title="Student Attendance" onBack={back} />
      <div className="px-4 pt-4 space-y-4">
        <div className="card text-center">
          <div className="text-base font-bold text-gray-900">{s.name}</div>
          <div className="text-xs text-gray-500 whitespace-nowrap">{s.arid} · {s.section}</div>
          <div className="text-5xl font-bold mt-3" style={{ color: pctColor(overall.pct) }}>{overall.pct}%</div>
          <div className="text-xs text-gray-500 mt-1">attended {overall.attended} of {overall.total} classes</div>
        </div>
        <div className="card space-y-3">
          <h3 className="label !mb-0">By course</h3>
          {courses.map(c => {
            const r = summarize(all, c);
            return (
              <div key={c}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="font-semibold text-gray-900">{c} · {courseByCode(c).name}</span>
                  <span className="font-bold" style={{ color: pctColor(r.pct) }}>{r.pct}%</span>
                </div>
                <Bar value={r.pct} />
                <div className="text-xs text-gray-500 mt-1">attended {r.attended} of {r.total} classes</div>
              </div>
            );
          })}
        </div>
        <div>
          <h3 className="title-section mb-2">Lecture history</h3>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <select className="field" aria-label="Course" value={course} onChange={e => setCourse(e.target.value)}>
              <option value="">All courses</option>
              {courses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="field" aria-label="Date range" value={range} onChange={e => setRange(e.target.value)}>
              <option value="">All dates</option>
              {RANGES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            {history.length === 0 && <div className="card text-center text-sm text-gray-500">No lectures in this range</div>}
            {history.map(a => (
              <div key={a.id} className="card !py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900">{fmtDate(a.iso)} · {fmtTime(a.start)}</div>
                  <div className="text-xs text-gray-500">{courseByCode(a.code).short} ({a.code}) · {a.venue}</div>
                  <div className="text-xs text-gray-500">Detected in {a.detected} of {TOTAL_CAPTURES}</div>
                </div>
                <span className={`tag ${a.present ? 'tag-green' : 'tag-red'}`}>{a.present ? 'Present' : 'Absent'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
