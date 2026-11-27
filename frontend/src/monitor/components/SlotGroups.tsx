import { ReactNode } from 'react';
import { DATE_MIN, TODAY, dayOf, DAY_FULL, fmtDate, prevWeekday, slotLabel } from '../data';

export function groupBySlot<T extends { sched: number }>(rows: T[]): [number, T[]][] {
  const map = new Map<number, T[]>();
  [...rows].sort((a, b) => a.sched - b.sched).forEach(r => map.set(r.sched, [...(map.get(r.sched) ?? []), r]));
  return [...map.entries()];
}

export function DateField({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  return (
    <div>
      <label className="label">Date</label>
      <input type="date" className="field" min={DATE_MIN} max={TODAY} value={value} onChange={e => e.target.value && onChange(e.target.value)} />
    </div>
  );
}

export function SlotBand({ start }: { start: number }) {
  return <div className="px-3 py-2 text-center text-xs font-extrabold tracking-wide" style={{ background: '#E2E8F0', color: '#102a43' }}>{slotLabel(start)}</div>;
}

export function EmptyDay({ iso, onJump }: { iso: string; onJump: (iso: string) => void }) {
  const day = dayOf(iso);
  const weekend = !DAY_FULL[day];
  return (
    <div className="card text-center text-sm text-gray-500 space-y-3">
      <p>{weekend ? `No classes on ${day === 'Sat' ? 'Saturday' : 'Sunday'} (${fmtDate(iso)}).` : `No physical classes were scheduled on ${fmtDate(iso)}.`}</p>
      {weekend && <button className="btn btn-secondary" onClick={() => onJump(prevWeekday(iso))}>Go to {fmtDate(prevWeekday(iso))}</button>}
    </div>
  );
}

export function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center no-print" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-2xl p-5 pb-6 max-h-[85vh] overflow-y-auto" style={{ maxWidth: 430 }}>
        <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-4" />
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-extrabold text-gray-900">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="w-11 h-11 -mr-3 flex items-center justify-center text-gray-500">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

