import { useEffect } from 'react';
import { Screen } from '../types';
import { courseByCode, fmtDate, fmtStamp, fmtTime, scheduleOn } from '../data';
import { useSwaps } from '../SwapContext';
import { useRemarks } from '../RemarkContext';
import Header from '../components/Header';

const Item = ({ k, v }: { k: string; v: string }) => (
  <div className="flex items-start justify-between gap-4 py-2.5 border-t border-gray-100 first:border-0">
    <span className="text-xs font-semibold text-gray-500">{k}</span>
    <span className="text-sm font-semibold text-gray-900 text-right">{v}</span>
  </div>
);

export default function Remark({ navigate, id, back }: { navigate: (s: Screen) => void; id: string | null; back: Screen }) {
  const { swaps } = useSwaps();
  const { remarks, markSeen } = useRemarks();
  const r = remarks.find(m => m.id === id);
  useEffect(() => { window.scrollTo(0, 0); if (id) markSeen(id); }, [id]);

  if (!r) return <div><Header title="Remark" onBack={() => navigate(back)} /></div>;
  const c = courseByCode(r.code);
  const o = scheduleOn(r.iso, swaps).find(x => x.section === r.section && x.code === r.code);

  return (
    <div className="pb-6">
      <Header title="Remark" onBack={() => navigate(back)} />
      <div className="px-4 pt-4 space-y-4">
        <div className="card">
          <Item k="Course" v={`${c.code} · ${c.name}`} />
          <Item k="Section" v={r.section} />
          <Item k="Date" v={fmtDate(r.iso)} />
          {o && <Item k="Time" v={`${fmtTime(o.start)} – ${fmtTime(o.end)}`} />}
          {o && <Item k="Venue" v={o.venue} />}
        </div>
        <div className="card">
          <h3 className="title-section mb-3">Remark from Director</h3>
          <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">{r.text}</p>
          <p className="text-xs text-gray-500 font-medium mt-3">{fmtStamp(r.sentAt)}</p>
        </div>
      </div>
    </div>
  );
}
