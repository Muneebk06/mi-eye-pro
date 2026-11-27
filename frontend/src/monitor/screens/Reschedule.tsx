import { useMemo, useState } from 'react';
import Header from '../components/Header';
import { Screen } from '../types';
import { SwapSide, TODAY, addDays, courseByCode, fmtDate, fmtTime, freeRescheduleOptions, isWeekday, scheduleOn } from '../data';
import { useSwaps } from '../SwapContext';

interface Props { navigate: (screen: Screen) => void; target: (SwapSide & { iso: string }) | null }

export default function Reschedule({ navigate, target }: Props) {
  const { swaps, reschedule } = useSwaps();
  const dates = useMemo(() => {
    const result: string[] = [];
    for (let i = 1; result.length < 8; i++) {
      const date = addDays(TODAY, i);
      if (isWeekday(date)) result.push(date);
    }
    return result;
  }, []);
  const [date, setDate] = useState(dates[0]);
  const [choice, setChoice] = useState<{ start: number; venue: string } | null>(null);
  const [done, setDone] = useState(false);
  const source = target && scheduleOn(target.iso, swaps).find(o => o.section === target.section && o.code === target.code);
  const slots = target ? freeRescheduleOptions(date, target, swaps) : [];

  const submit = () => {
    if (!target || !choice) return;
    if (reschedule(target.iso, target, date, choice.start, choice.venue)) setDone(true);
  };

  if (done) {
    return (
      <div className="pb-6">
        <Header title="Re-schedule" onBack={() => navigate('myClasses')} />
        <div className="px-4 pt-4 space-y-4">
          <div className="card bg-green-50 border-green-200">
            <div className="text-sm font-bold text-green-700">Lecture rescheduled</div>
            <div className="text-xs text-green-700 mt-1">{fmtDate(date)} · {choice && fmtTime(choice.start)} · {choice?.venue}</div>
            <div className="text-xs text-green-700 mt-1">Admin, students, and Director have been notified.</div>
          </div>
          <button className="btn" onClick={() => navigate('myClasses')}>Back to Timetable</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <Header title="Re-schedule" onBack={() => navigate('myClasses')} />
      <div className="px-4 pt-4 space-y-4">
        {!target || !source ? <div className="card text-sm text-gray-500 text-center">Select a missed lecture from the timetable to re-schedule it.</div> : (
          <>
            <div>
              <span className="label">Selected missed lecture</span>
              <div className="card border-red-200 bg-red-50">
                <span className="tag tag-red">Not Held</span>
                <div className="text-sm font-bold text-gray-900 mt-2">{source.code} · {courseByCode(source.code).name}</div>
                <div className="text-xs text-gray-600 mt-1">{source.section} · {fmtDate(source.iso)}</div>
                <div className="text-xs text-gray-600 mt-1">{fmtTime(source.start)} – {fmtTime(source.end)} · {source.venue}</div>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="reschedule-date">New date</label>
              <select id="reschedule-date" className="field" value={date} onChange={event => { setDate(event.target.value); setChoice(null); }}>
                {dates.map(item => <option key={item} value={item}>{fmtDate(item)}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              {slots.length === 0 && <div className="card text-sm text-gray-500 text-center">No free slots on this date.</div>}
              {slots.map(slot => (
                <div key={slot.start} className="card">
                  <div className="text-sm font-bold text-gray-900">{fmtTime(slot.start)} – {fmtTime(slot.end)}</div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {slot.venues.map(venue => {
                      const active = choice?.start === slot.start && choice.venue === venue;
                      return <button key={venue} onClick={() => setChoice({ start: slot.start, venue })} className={`min-h-10 px-3 rounded-lg border text-xs font-semibold ${active ? 'bg-primary border-primary text-white' : 'bg-white border-gray-200 text-gray-600'}`}>{venue}</button>;
                    })}
                  </div>
                </div>
              ))}
            </div>
            <button className="btn" disabled={!choice} onClick={submit}>Confirm Re-schedule</button>
          </>
        )}
      </div>
    </div>
  );
}
