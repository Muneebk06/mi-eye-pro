import { useState } from 'react';
import { Screen } from '../types';
import { DAYS, TEACHER, TODAY, addDays, courseByCode, dayOf, fmtDate, fmtTime, hasStarted, isWeekday, nextWeekday, reportRows, scheduleOn, Occ } from '../data';
import { useSwaps } from '../SwapContext';
import Header from '../components/Header';
import { Icon, IconName } from '../components/Icons';

interface Props { navigate: (s: Screen) => void; onSwap: (o: Occ) => void; onReschedule: (o: Occ) => void; onMenu: () => void }
type Mode = 'reschedule' | 'preschedule';

const mondayOf = (iso: string) => addDays(iso, -DAYS.indexOf(dayOf(iso)));
const startDay = isWeekday(TODAY) ? TODAY : nextWeekday(TODAY);

const SelectDot = ({ selected }: { selected: boolean }) => (
  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'border-primary' : 'border-gray-300'}`}>
    {selected && <span className="w-2.5 h-2.5 rounded-full bg-primary" />}
  </span>
);

const ModeCard = ({ active, icon, title, subtitle, onClick }: { active: boolean; icon: IconName; title: string; subtitle: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    role="radio"
    aria-checked={active}
    className={`card w-full text-left flex items-center gap-3 active:opacity-80 ${active ? 'border-green-600 bg-green-50' : ''}`}
  >
    <span className="menu-icon"><Icon name={icon} size={20} /></span>
    <span className="min-w-0">
      <span className="block text-sm font-bold text-gray-900">{title}</span>
      <span className="block text-xs text-gray-500 mt-0.5">{subtitle}</span>
    </span>
  </button>
);

export default function MyClasses({ navigate, onSwap, onReschedule, onMenu }: Props) {
  const { swaps } = useSwaps();
  const [mode, setMode] = useState<Mode>('reschedule');
  const [date, setDate] = useState(startDay);
  const [selected, setSelected] = useState<Occ | null>(null);
  const week = DAYS.map((_, i) => addDays(mondayOf(date), i));

  const missed = reportRows(swaps)
    .filter(row => row.teacher === TEACHER && row.status === 'Not Held')
    .map<Occ>(row => ({
      id: row.id,
      iso: row.iso,
      section: row.section,
      code: row.code,
      teacher: row.teacher,
      venue: row.venue,
      start: row.sched,
      end: row.end,
      online: false,
    }));
  const upcoming = scheduleOn(date, swaps)
    .filter(lecture => lecture.teacher === TEACHER && !lecture.online && !hasStarted(date, lecture.start));
  const visible = mode === 'reschedule' ? missed : upcoming;

  const changeMode = (next: Mode) => {
    setMode(next);
    setSelected(null);
  };
  const changeDate = (next: string) => {
    setDate(next);
    setSelected(null);
  };
  const shift = (n: number) => changeDate(addDays(date, n * 7));
  const proceed = () => {
    if (!selected) return;
    if (mode === 'reschedule') onReschedule(selected);
    else onSwap(selected);
  };

  return (
    <div className="pb-28">
      <Header
        title="Schedule a class"
        onMenu={onMenu}
        onNotifications={() => navigate('notifications')}
      />
      <div className="px-4 pt-4 space-y-4">
        <div className="space-y-2" role="radiogroup" aria-label="Schedule action">
          <ModeCard
            active={mode === 'reschedule'}
            icon="clock"
            title="Reschedule missed class"
            subtitle="Choose a class that was not held"
            onClick={() => changeMode('reschedule')}
          />
          <ModeCard
            active={mode === 'preschedule'}
            icon="timetable"
            title="Pre-schedule a class"
            subtitle="Choose an upcoming class"
            onClick={() => changeMode('preschedule')}
          />
        </div>

        {mode === 'preschedule' && (
          <>
            <div className="flex items-center justify-between">
              <button onClick={() => shift(-1)} aria-label="Previous week" className="w-11 h-11 -ml-3 flex items-center justify-center text-gray-600 active:opacity-60"><Icon name="back" size={20} /></button>
              <span className="text-xs font-semibold text-gray-600">{fmtDate(week[0])} – {fmtDate(week[4])}</span>
              <button onClick={() => shift(1)} aria-label="Next week" className="w-11 h-11 -mr-3 flex items-center justify-center text-gray-600 active:opacity-60"><Icon name="chevron" size={20} /></button>
            </div>
            <div className="seg grid grid-cols-5">
              {week.map(day => (
                <button key={day} onClick={() => changeDate(day)} className="seg-btn !min-h-12 !text-xs leading-tight" style={{ background: date === day ? '#166534' : 'transparent', color: date === day ? '#fff' : '#64748B' }}>
                  {day === TODAY ? 'Today' : dayOf(day)}<br />{Number(day.slice(8))}
                </button>
              ))}
            </div>
            <div>
              <label className="label" htmlFor="schedule-date">Go to date</label>
              <input id="schedule-date" type="date" className="field" value={date} onChange={event => changeDate(event.target.value)} />
            </div>
          </>
        )}

        <div className="space-y-2" role="radiogroup" aria-label={mode === 'reschedule' ? 'Missed classes' : 'Upcoming classes'}>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            {mode === 'reschedule' ? 'Missed classes' : 'Upcoming classes'}
          </h3>
          {visible.length === 0 && (
            <div className="card text-sm text-gray-500 text-center">
              {mode === 'reschedule' ? 'No missed classes to reschedule.' : 'No upcoming classes on this day.'}
            </div>
          )}
          {visible.map(lecture => {
            const active = selected?.id === lecture.id;
            const course = courseByCode(lecture.code);
            return (
              <button
                key={lecture.id}
                onClick={() => setSelected(lecture)}
                role="radio"
                aria-checked={active}
                className={`card w-full text-left flex gap-3 active:opacity-80 ${active ? 'border-green-600 bg-green-50' : ''}`}
              >
                <SelectDot selected={active} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-bold text-gray-900">{course.code} · {course.name}</span>
                    <span className={`tag flex-shrink-0 ${mode === 'reschedule' ? 'tag-red' : 'tag-blue'}`}>
                      {mode === 'reschedule' ? 'Not Held' : 'Upcoming'}
                    </span>
                  </span>
                  <span className="block text-xs text-gray-600 mt-2">{fmtDate(lecture.iso)} · {fmtTime(lecture.start)} – {fmtTime(lecture.end)}</span>
                  <span className="block text-xs text-gray-500 mt-1">{lecture.section} · {lecture.venue}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="class-action fixed left-1/2 -translate-x-1/2 z-30 w-full max-w-[430px] px-4 py-3 bg-surface/95 border-t border-gray-200"
        style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
      >
        <button className="btn" disabled={!selected} onClick={proceed}>
          {mode === 'reschedule' ? 'Reschedule' : 'Pre-schedule'}
        </button>
      </div>
    </div>
  );
}
