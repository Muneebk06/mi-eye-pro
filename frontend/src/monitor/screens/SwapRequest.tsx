import { useState } from 'react';
import { Screen } from '../types';
import { Occ, SwapSide, classLabel, courseByCode, fmtDate, fmtTime, scheduleOn, swapOptions } from '../data';
import { useSwaps } from '../SwapContext';
import Header from '../components/Header';

interface Props { navigate: (s: Screen) => void; target: (SwapSide & { iso: string }) | null; initialKind?: 'venue' | 'time' }

const Radio = ({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) => (
  <button
    onClick={onClick}
    role="radio"
    aria-checked={on}
    className="w-full text-left rounded-xl p-4 flex items-start gap-3 min-h-14 active:opacity-80"
    style={{ border: `2px solid ${on ? '#166534' : '#E2E8F0'}`, background: on ? '#F0FDF4' : '#fff' }}
  >
    <span className="mt-0.5 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center" style={{ border: `2px solid ${on ? '#166534' : '#CBD5E1'}` }}>
      {on && <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#166534' }} />}
    </span>
    <span className="min-w-0 flex-1">{children}</span>
  </button>
);

export default function SwapRequest({ navigate, target, initialKind }: Props) {
  const { swaps, send } = useSwaps();
  const [kind, setKind] = useState<'venue' | 'time' | null>(initialKind ?? null);
  const iso = target?.iso ?? '';
  const [pick, setPick] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (!target) { return <div className="p-4"><Header title="Request Swap" onBack={() => navigate('myClasses')} /></div>; }
  const mine = scheduleOn(target.iso, swaps).find(o => o.section === target.section && o.code === target.code)!;
  const here = mine;
  const options: Occ[] = kind
    ? swapOptions(kind, target, iso, swaps).filter(option => kind !== 'time' || option.start < here.start)
    : [];
  const chosen = options.find(o => o.id === pick);

  const doSend = () => {
    if (!kind || !chosen) return;
    send(kind, iso, { section: target.section, code: target.code }, { section: chosen.section, code: chosen.code });
    setSent(true);
  };

  if (sent && chosen && kind) {
    return (
      <div className="pb-6">
        <Header title={initialKind === 'time' ? 'Pre-schedule' : 'Request Swap'} onBack={() => navigate('myClasses')} />
        <div className="px-4 pt-4 space-y-4">
          <div className="rounded-xl bg-green-50 border border-green-200 text-green-700 p-4 space-y-1">
            <div className="text-sm font-bold">Request sent to {chosen.teacher}</div>
            <div className="text-xs">{kind === 'venue' ? 'Venue' : 'Time'} swap · {fmtDate(iso)}</div>
          </div>
          <button className="btn" onClick={() => navigate('mySwaps')}>Open My Swaps</button>
          <button className="btn btn-secondary" onClick={() => navigate('myClasses')}>Back to My Timetable</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <Header title={initialKind === 'time' ? 'Pre-schedule' : 'Request Swap'} onBack={() => navigate('myClasses')} />
      <div className="px-4 pt-4 space-y-4">
        <div className="card" style={{ background: '#F0FDF4', borderColor: '#BBF7D0' }}>
          <span className="label !mb-1">Your future lecture</span>
          <div className="text-sm font-bold text-gray-900">{courseByCode(target.code).code} · {courseByCode(target.code).name}</div>
          <div className="text-xs text-gray-600 mt-1">{fmtDate(iso)} · {fmtTime(here.start)} – {fmtTime(here.end)}</div>
          <div className="text-xs text-gray-600 mt-1">{target.section} · {here.venue} · {here.teacher}</div>
        </div>

        {!initialKind && <div className="space-y-2" role="radiogroup" aria-label="Swap type">
          <span className="label !mb-0">1. Swap type</span>
          <Radio on={kind === 'venue'} onClick={() => { setKind('venue'); setPick(null); }}>
            <div className="text-sm font-bold text-gray-900">Venue swap</div>
          </Radio>
          <Radio on={kind === 'time'} onClick={() => { setKind('time'); setPick(null); }}>
            <div className="text-sm font-bold text-gray-900">Time swap (pre-schedule)</div>
            <div className="text-xs text-gray-500 mt-1">Exchange with an eligible earlier lecture from another teacher.</div>
          </Radio>
        </div>}

        {kind && (
          <div className="space-y-2" role="radiogroup" aria-label="Compatible classes">
            <span className="label !mb-0">{initialKind === 'time' ? 'Eligible lectures' : '2. Eligible lectures'}</span>
            {options.length === 0 && <div className="card text-sm text-gray-500 text-center">No eligible lectures are available for this swap.</div>}
            {options.map(o => (
              <Radio key={o.id} on={pick === o.id} onClick={() => setPick(o.id)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-bold text-gray-900">{o.teacher}</div>
                  <span className="tag tag-green">Available</span>
                </div>
                <div className="text-xs text-gray-600 mt-1">{courseByCode(o.code).short} · {o.section}</div>
                <div className="text-xs text-gray-500 mt-0.5">{fmtDate(iso)} · {fmtTime(o.start)} – {fmtTime(o.end)} · {o.venue}</div>
              </Radio>
            ))}
          </div>
        )}

        {chosen && (
          <div className="card">
            <span className="label !mb-2">Confirm both lectures</span>
            <div className="text-sm font-bold text-gray-900">{here.teacher} · {classLabel(target)}</div>
            <div className="text-xs text-gray-500">{fmtDate(iso)} · {fmtTime(here.start)} – {fmtTime(here.end)} · {here.venue}</div>
            <div className="border-t border-gray-200 my-3" />
            <div className="text-sm font-bold text-gray-900">{chosen.teacher} · {classLabel(chosen)}</div>
            <div className="text-xs text-gray-500">{fmtDate(iso)} · {fmtTime(chosen.start)} – {fmtTime(chosen.end)} · {chosen.venue}</div>
          </div>
        )}

        <button className="btn" disabled={!kind || !chosen} onClick={doSend}>
          {`Send request${chosen ? ` to ${chosen.teacher}` : ''}`}
        </button>
        {chosen && <p className="text-xs text-gray-500 text-center">{classLabel(target)} and {classLabel(chosen)}</p>}
      </div>
    </div>
  );
}
