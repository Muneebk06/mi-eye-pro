import { useRemarks } from '../RemarkContext';
import { Icon } from '../components/Icons';
import { ReportRow, courseByCode, fmtDash, rowsOn } from '../data';
import { useSwaps } from '../SwapContext';
import { useSticky, matches, SearchBar, NoResults } from '../components/Search';
import { DateField, EmptyDay, SlotBand, groupBySlot } from '../components/SlotGroups';
const logo = '/biit.png';

const COLS = '18px 38px minmax(0,1fr) 54px 42px 62px';
const ROW_BG = { 'Held On Time': '#fff', Late: '#FFFBEB', 'Not Held': '#FEE2E2' } as const;
const ROW_EDGE = { 'Held On Time': 'transparent', Late: '#D97706', 'Not Held': '#B91C1C' } as const;
const CHIP: Record<ReportRow['status'], { bg: string; fg: string }> = {
  'Held On Time': { bg: '#DCFCE7', fg: '#166534' },
  Late: { bg: '#FEF3C7', fg: '#92400E' },
  'Not Held': { bg: '#FEE2E2', fg: '#B91C1C' },
};

const Chip = ({ r }: { r: ReportRow }) => (
  <div className="flex flex-col items-center gap-0.5">
    <span className="rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-tight text-center" style={{ background: CHIP[r.status].bg, color: CHIP[r.status].fg }}>{r.status}</span>
    {r.status === 'Late' && <span className="text-[11px] font-semibold text-amber-800">{r.lateIn} min</span>}
  </div>
);

export default function ClassHeldReport({ date, setDate, onOpen }: { date: string; setDate: (iso: string) => void; onOpen: (r: ReportRow) => void }) {
  const { swaps } = useSwaps();
  const { remarks } = useRemarks();
  const [q, setQ] = useSticky('chr-q', '');
  const [chip, setChip] = useSticky<string>('chr-chip', 'All');
  const all = rowsOn(date, swaps);
  const rows = all.filter(r => (chip === 'All' || r.status === chip) && matches(q, courseByCode(r.code).short, courseByCode(r.code).name, r.code, r.teacher, r.venue));
  const groups = groupBySlot(rows);

  return (
    <div className="space-y-4">
      <div className="card no-print grid grid-cols-[1fr_auto] gap-3 items-end">
        <DateField value={date} onChange={setDate} />
        <button onClick={() => window.print()} className="btn !w-auto !min-h-12 gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v3h16v-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Export PDF
        </button>
      </div>

      <div className="no-print space-y-2">
        <SearchBar value={q} onChange={setQ} placeholder="Search course, teacher or venue" count={rows.length} noun="result" />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Status">
          {(['All', 'Held On Time', 'Late', 'Not Held'] as const).map(c => (
            <button key={c} onClick={() => setChip(c)} aria-pressed={chip === c} className="min-h-11 px-3 rounded-full border text-xs font-semibold" style={{ background: chip === c ? '#166534' : '#fff', color: chip === c ? '#fff' : '#334155', borderColor: chip === c ? '#166534' : '#CBD5E1' }}>{c}</button>
          ))}
        </div>
      </div>

      <div className="print-area -mx-2 sm:mx-0">
        <div className="flex items-center gap-3 px-2 pb-3">
          <img src={logo} alt="BIIT" className="w-12 h-12 rounded-full bg-white object-cover flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-[15px] font-extrabold leading-tight" style={{ color: '#102a43' }}>Barani Institute of Information Technology</div>
            <div className="text-sm font-bold mt-0.5" style={{ color: '#166534' }}>Class held report {fmtDash(date)}</div>
          </div>
        </div>

        {groups.length === 0 ? (
          <div className="px-2">{all.length > 0 ? <NoResults onClear={() => { setQ(''); setChip('All'); }} /> : <EmptyDay iso={date} onJump={setDate} />}</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden text-[12px] leading-tight text-gray-900">
            <div className="grid items-center gap-x-1 px-1 py-2 font-bold text-white text-center" style={{ gridTemplateColumns: COLS, background: '#102a43' }}>
              <span>Sr#</span><span>Course</span><span className="text-left">Teacher</span><span>Discipline</span><span>Venue</span><span>Status</span>
            </div>
            {groups.map(([start, list]) => (
              <div key={start}>
                <SlotBand start={start} />
                {list.map((r, i) => (
                  <button
                    key={r.id}
                    onClick={() => onOpen(r)}
                    className="grid w-full items-center gap-x-1 px-1 py-2 min-h-11 border-t border-gray-200 text-center active:opacity-70"
                    style={{ gridTemplateColumns: COLS, background: ROW_BG[r.status], boxShadow: `inset 3px 0 0 ${ROW_EDGE[r.status]}` }}
                  >
                    <span>{i + 1}</span>
                    <span className="font-bold">{courseByCode(r.code).short}</span>
                    <span className="text-left break-words">{r.teacher}{remarks.some(m => m.id === r.id) && <span className="inline-block align-middle ml-1 text-[#166534]" aria-label="Remark sent"><Icon name="remark" size={14} /></span>}</span>
                    <span className="break-words">{r.section}</span>
                    <span className="font-semibold">{r.venue}</span>
                    <Chip r={r} />
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
        <p className="no-print text-xs text-gray-500 text-center mt-3">Tap a row for details. Late means more than 10 minutes after the scheduled start. Online classes are not included.</p>
      </div>

    </div>
  );
}
