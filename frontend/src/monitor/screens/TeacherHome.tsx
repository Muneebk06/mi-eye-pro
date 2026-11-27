import { useEffect, useState } from 'react';
import { Screen } from '../types';
import { TEACHER, TODAY, addDays, courseByCode, dayOf, fmtTime, isWeekday, nowMinutes, rowsOn, scheduleOn, Occ } from '../data';
import { useSwaps } from '../SwapContext';
import Header from '../components/Header';
import { Icon } from '../components/Icons';

interface Props { navigate: (s: Screen) => void; onMenu: () => void }

type State = 'upcoming' | 'held' | 'nothld' | 'resched';

const CHIP: Record<State, { t: string; c: string }> = {
  upcoming: { t: 'Upcoming', c: 'tag-blue' },
  held: { t: 'Held', c: 'tag-green' },
  nothld: { t: 'Not Held', c: 'tag-red' },
  resched: { t: 'Rescheduled', c: 'tag-info' },
};

const greeting = (now: number) => {
  const h = Math.floor(now / 60);
  return h < 12 ? 'Good morning,' : h < 17 ? 'Good afternoon,' : 'Good evening,';
};
const dayLabel = (iso: string) => `${dayOf(iso)}, ${Number(iso.slice(8))} ${new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short' })}`;
const inMins = (m: number) => (m < 60 ? `in ${m} min` : `in ${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`);

export default function TeacherHome({ navigate, onMenu }: Props) {
  const { swaps } = useSwaps();
  const [now, setNow] = useState(nowMinutes);
  useEffect(() => {
    const t = setInterval(() => setNow(nowMinutes()), 15000);
    return () => clearInterval(t);
  }, []);
  const reports = rowsOn(TODAY, swaps);

  const rescheduledAway = swaps
    .filter(w => w.kind === 'reschedule' && w.status === 'applied' && w.sourceIso === TODAY && w.fromTeacher === TEACHER)
    .map(w => scheduleOn(TODAY, swaps.filter(s => s.id !== w.id)).find(o => o.section === w.from.section && o.code === w.from.code))
    .filter((o): o is Occ => Boolean(o));
  const today = [
    ...scheduleOn(TODAY, swaps).filter(o => o.teacher === TEACHER).map(o => ({ o, rescheduled: false })),
    ...rescheduledAway.map(o => ({ o, rescheduled: true })),
  ].sort((a, b) => a.o.start - b.o.start);

  const stateOf = (o: Occ, rescheduled: boolean): State => {
    if (rescheduled) return 'resched';
    if (o.start > now) return 'upcoming';
    return reports.find(x => x.id === o.id)?.status === 'Not Held' ? 'nothld' : 'held';
  };
  const rows = today.map(x => ({ ...x, state: stateOf(x.o, x.rescheduled) }));
  const nextToday = rows.find(r => r.state === 'upcoming')?.o;
  let later: Occ | undefined;
  if (!nextToday) {
    for (let i = 1; i <= 21 && !later; i++) {
      const iso = addDays(TODAY, i);
      if (isWeekday(iso)) later = scheduleOn(iso, swaps).find(o => o.teacher === TEACHER);
    }
  }

  return (
    <div className="pb-6">
      <Header
        title="Dashboard"
        showMenu
        onMenu={onMenu}
        onNotifications={() => navigate('notifications')}
        hero={<div><p className="text-sm text-white/90">{greeting(now)}</p><h2 className="text-white text-[22px] font-bold leading-tight">{TEACHER}</h2><p className="text-xs text-white/80 mt-0.5">Employee No. EMP-1001</p></div>}
      />
      <div className="dashboard-grid px-4 -mt-6 relative z-30 space-y-3">
        <div className="card" style={{ borderLeft: '4px solid #166534' }}>
          <h3 className="label !mb-1 !text-gray-600">Next class</h3>
          {(() => {
            const o = nextToday ?? later;
            if (!o) return <div className="text-sm text-gray-500">No upcoming classes.</div>;
            return (
              <>
                <div className="stat">{nextToday ? fmtTime(o.start) : `${dayLabel(o.iso)} · ${fmtTime(o.start)}`}</div>
                <div className="title-card mt-1">{o.code} · {courseByCode(o.code).name}</div>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                  <span className="flex items-center gap-1"><Icon name="user" size={16} />{o.section}</span>
                  <span className="flex items-center gap-1"><Icon name="pin" size={16} />{o.venue}</span>
                  {nextToday && <span className="ml-auto text-xs font-semibold text-gray-600">{inMins(o.start - now)}</span>}
                </div>
              </>
            );
          })()}
        </div>

        <div className="card">
          <h3 className="title-card">Today's classes</h3>
          {rows.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No classes today.</p>
          ) : (
            <div className="mt-2 divide-y divide-gray-100">
              {rows.map(({ o, rescheduled, state }) => {
                const chip = CHIP[state];
                return (
                  <div
                    key={`${o.id}-${rescheduled}`}
                    className="py-3 first:pt-1 last:pb-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm min-w-0"><b className="font-semibold text-gray-900">{o.code}</b> <span className="text-gray-600">{courseByCode(o.code).name}</span></span>
                      <span className={`tag flex-shrink-0 ${chip.c}`}>{chip.t}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{fmtTime(o.start)} – {fmtTime(o.end)} · {o.section} · {o.venue}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
