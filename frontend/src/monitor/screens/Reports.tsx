import { useState } from 'react';
import { Screen, Role } from '../types';
import { ReportRow, ModResult, moduleData, courseByCode, isOwn, fmtDate, fmtTime, rowsOn } from '../data';
import { useSwaps } from '../SwapContext';
import Header from '../components/Header';
import { useSticky, matches, SearchBar, NoResults } from '../components/Search';
import { DateField, EmptyDay, SlotBand, groupBySlot } from '../components/SlotGroups';
import ClassHeldReport from './ClassHeldReport';

interface Props { navigate: (s: Screen) => void; role: Role; tab: 'chr' | 'activity'; setTab: (t: 'chr' | 'activity') => void; date: string; setDate: (d: string) => void; onOpenChr: (r: ReportRow) => void; onMenu?: () => void }

const MOD_TAG = { ready: 'tag-green', processing: 'tag-info', nodata: 'tag-blue' } as const;
const MOD_LABEL = { ready: 'Ready', processing: 'Processing', nodata: 'No data' } as const;

const Chip = ({ m }: { m: ModResult }) => <span className={`tag ${MOD_TAG[m.state]}`}>{m.chip}</span>;

export default function Reports({ navigate, role, tab: tabIn, setTab, date, setDate, onOpenChr, onMenu }: Props) {
  const { swaps } = useSwaps();
  const tabs = role === 'director' ? ([['chr', 'Class Held Report'], ['activity', 'Class Activity']] as const) : ([['activity', 'Class Activity']] as const);
  const tab = (tabs as readonly (readonly ['chr' | 'activity', string])[]).some(t => t[0] === tabIn) ? tabIn : tabs[0][0];
  const [open, setOpen] = useState<ReportRow | null>(null);
  const [q, setQ] = useSticky('activity-q', '');

  if (open) {
    const c = courseByCode(open.code);
    return (
      <div className="pb-6">
        <Header title="Class Activity" onBack={() => setOpen(null)} />
        <div className="px-4 pt-4 space-y-3">
          <div className="card">
            <div className="text-sm font-bold text-gray-900">{c.short} · {c.name}</div>
            <div className="text-xs text-gray-500 mt-1">{fmtDate(open.iso)} · {fmtTime(open.actual ?? open.sched)} · {open.section}</div>
            <div className="text-xs text-gray-500">{open.teacher} · {open.venue}</div>
            {open.remark && <span className="tag tag-amber mt-2">{open.remark}</span>}
          </div>
          {moduleData(open).map(m => (
            <div key={m.name} className="card">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-gray-900">{m.name}</div>
                <span className={`tag ${MOD_TAG[m.state]}`}>{MOD_LABEL[m.state]}</span>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {m.state === 'ready' ? m.summary : m.state === 'processing' ? 'Processing. Results will appear here shortly.' : 'No data was captured for this module.'}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const base = rowsOn(date, swaps).filter(r => r.status !== 'Not Held' && (role !== 'teacher' || isOwn(r.code)));
  const held = base.filter(r => matches(q, courseByCode(r.code).short, courseByCode(r.code).name, r.code, r.teacher, r.section));
  const groups = groupBySlot(held);

  return (
    <div className="pb-6">
      <Header title="Reports" onBack={onMenu ? undefined : () => navigate('dashboard')} onMenu={onMenu} />
      <div className="px-4 pt-4 space-y-4">
        {tabs.length > 1 && (
          <div className="no-print seg grid grid-cols-2">
            {tabs.map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className="seg-btn" style={{ background: tab === k ? '#166534' : 'transparent', color: tab === k ? '#fff' : '#64748B' }}>{l}</button>
            ))}
          </div>
        )}

        {tab === 'chr' ? <ClassHeldReport date={date} setDate={setDate} onOpen={onOpenChr} /> : (
          <>
            <div className="card"><DateField value={date} onChange={setDate} /></div>
            <SearchBar value={q} onChange={setQ} placeholder="Search course, teacher or section" count={held.length} />
            {groups.length === 0 && (base.length > 0 ? <NoResults onClear={() => setQ('')} /> : <EmptyDay iso={date} onJump={setDate} />)}
            {groups.map(([start, list]) => (
              <div key={start} className="rounded-xl overflow-hidden border border-gray-200 bg-white">
                <SlotBand start={start} />
                {list.map(r => (
                  <button key={r.id} onClick={() => setOpen(r)} className="w-full text-left px-3 py-3 border-t border-gray-100 active:opacity-70">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-gray-900">{courseByCode(r.code).short} · {r.section}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{r.teacher} · {r.venue}</div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1.5 flex-shrink-0">{moduleData(r).map(m => <Chip key={m.name} m={m} />)}</div>
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
