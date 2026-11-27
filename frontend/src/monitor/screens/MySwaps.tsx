import { useState } from 'react';
import { Screen } from '../types';
import { Swap, TEACHER, classLabel, fmtDate, scheduleOn } from '../data';
import { useSwaps } from '../SwapContext';
import Header from '../components/Header';

const TAG = { pending: 'tag-amber', accepted: 'tag-green', declined: 'tag-red', applied: 'tag-green' } as const;
const LABEL = { pending: 'Pending', accepted: 'Accepted', declined: 'Declined', applied: 'Applied' } as const;

export function SwapActions({ swap, onDecide }: { swap: Swap; onDecide: (d: 'accepted' | 'declined') => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 mt-3">
      <button className="btn btn-secondary !text-red-700 !border-red-200" onClick={() => onDecide('declined')}>Decline</button>
      <button className="btn" onClick={() => onDecide('accepted')}>Accept</button>
    </div>
  );
}

export default function MySwaps({ navigate }: { navigate: (s: Screen) => void }) {
  const { swaps, decide } = useSwaps();
  const [tab, setTab] = useState<'sent' | 'received'>('sent');
  const sent = swaps.filter(w => w.kind !== 'reschedule' && w.fromTeacher === TEACHER);
  const received = swaps.filter(w => w.kind !== 'reschedule' && w.toTeacher === TEACHER && w.status !== 'applied');
  const list = tab === 'sent' ? sent : received;

  return (
    <div className="pb-6">
      <Header title="My Swaps" onBack={() => navigate('myClasses')} />
      <div className="px-4 pt-4 space-y-3">
        <div className="grid seg grid grid-cols-2">
          {([['sent', `Sent (${sent.length})`], ['received', `Received (${received.length})`]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className="seg-btn" style={{ background: tab === k ? '#166534' : 'transparent', color: tab === k ? '#fff' : '#64748B' }}>{l}</button>
          ))}
        </div>
        {list.length === 0 && <div className="card text-sm text-gray-500 text-center">{tab === 'sent' ? 'You have not sent any swap requests.' : 'No swap requests received.'}</div>}
        {list.map(w => {
          const other = tab === 'sent' ? w.toTeacher : w.fromTeacher;
          const mine = tab === 'sent' ? w.from : w.to;
          const theirs = tab === 'sent' ? w.to : w.from;
          const a = mine && scheduleOn(w.iso, []).find(o => o.section === mine.section && o.code === mine.code);
          const b = theirs && scheduleOn(w.iso, []).find(o => o.section === theirs.section && o.code === theirs.code);
          const route = w.kind === 'venue' ? (tab === 'sent' ? `${w.fromVenue} to ${w.venue}` : `${w.venue} to ${w.fromVenue}`) : '';
          return (
            <div key={w.id} className="card">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-gray-900">{w.kind === 'venue' ? 'Venue' : 'Time'} · {fmtDate(w.iso)}</span>
                <span className={`tag ${TAG[w.status]}`}>{LABEL[w.status]}</span>
              </div>
              {route && <div className="text-sm font-semibold text-gray-900 mt-2">{route}</div>}
              {w.to && <div className="text-xs text-gray-500 mt-2">{tab === 'sent' ? 'To' : 'From'} <b className="text-gray-900">{other}</b></div>}
              <div className="text-xs text-gray-600 mt-1">
                {mine ? <>Your {classLabel(mine)} {a && `(${a.venue})`}{theirs && <> with {classLabel(theirs)} {b && `(${b.venue})`}</>}</> : <>Your {classLabel(w.from)} moved to {w.venue}</>}
              </div>
              {(w.status === 'accepted' || w.status === 'applied') && <div className="text-xs font-semibold mt-2" style={{ color: '#166534' }}>Applied to {fmtDate(w.iso)} only</div>}
              {w.status === 'pending' && tab === 'received' && <SwapActions swap={w} onDecide={d => decide(w.id, d)} />}
              {w.status === 'pending' && tab === 'sent' && (
                <div className="mt-3 rounded-xl border border-dashed border-gray-300 p-3">
                  <div className="text-xs text-gray-500 font-semibold">Prototype only: answer as {other}</div>
                  <SwapActions swap={w} onDecide={d => decide(w.id, d)} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
