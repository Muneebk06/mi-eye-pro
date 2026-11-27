import { useEffect, useState } from 'react';
import { Screen } from '../types';
import { ReportRow, courseByCode, fmtStamp, fmtTime } from '../data';
import { useRemarks } from '../RemarkContext';
import Header from '../components/Header';

const Item = ({ k, v }: { k: string; v: string }) => (
  <div className="flex items-start justify-between gap-4 py-2.5 border-t border-gray-100 first:border-0">
    <span className="text-xs font-semibold text-gray-500">{k}</span>
    <span className="text-sm font-semibold text-gray-900 text-right">{v}</span>
  </div>
);

const MAX = 500;

export default function ClassDetail({ navigate, row }: { navigate: (s: Screen) => void; row: ReportRow | null }) {
  const { remarks, send } = useRemarks();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  useEffect(() => { window.scrollTo(0, 0); }, []);

  if (!row) return <div><Header title="Class Detail" onBack={() => navigate('reports')} /></div>;
  const c = courseByCode(row.code);
  const remark = remarks.find(m => m.id === row.id);
  const doSend = async () => {
    setSending(true);
    await send(row, text.trim());
    setSending(false);
  };

  return (
    <div className="pb-6">
      <Header title={`${c.short} - ${row.section}`} onBack={() => navigate('reports')} />
      <div className="px-4 pt-4 space-y-4">
        <div className="card">
          <Item k="Teacher" v={row.teacher} />
          <Item k="Course" v={`${c.code} · ${c.name}`} />
          <Item k="Venue" v={row.venue} />
          <Item k="Scheduled" v={`${fmtTime(row.sched)} – ${fmtTime(row.end)}`} />
          <Item k="Status" v={row.status} />
          <Item k="Time In" v={row.actual === null ? 'Not detected' : fmtTime(row.actual)} />
          <Item k="Time Out" v={row.timeOut === null ? 'Not detected' : fmtTime(row.timeOut)} />
          <Item k="Late In (min)" v={row.actual === null ? '--' : String(row.lateIn)} />
          <Item k="Left Early (min)" v={row.timeOut === null ? '--' : String(row.leftEarly)} />
          <Item k="Remarks" v={row.remark || '--'} />
          <p className="text-xs text-gray-500 mt-3">Time In and Time Out come from camera detection of the teacher.</p>
        </div>

        <div className="card">
          <h3 className="title-section mb-3">Remarks to teacher</h3>
          {remark ? (
            <div className="rounded-xl p-3 space-y-2" style={{ background: '#F8FAFC' }}>
              <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">{remark.text}</p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-500 font-medium">Sent {fmtStamp(remark.sentAt)}</span>
                <span className={`tag ${remark.status === 'seen' ? 'tag-green' : 'tag-blue'}`}>{remark.status === 'seen' ? 'Seen by teacher' : 'Delivered'}</span>
              </div>
            </div>
          ) : (
            <div>
              <textarea
                rows={3}
                maxLength={MAX}
                value={text}
                disabled={sending}
                onChange={e => setText(e.target.value)}
                placeholder={`Write a remark for ${row.teacher}`}
                className="field py-3 min-h-[72px]"
                aria-label="Remarks to teacher"
              />
              <div className="text-right text-xs text-gray-500 mt-1">{text.length}/{MAX}</div>
            </div>
          )}
        </div>
      </div>

      {!remark && text.trim() !== '' && (
        <div className="sticky z-10 px-4 pt-3 pb-3 bg-gradient-to-t from-[#F8FAFC] via-[#F8FAFC] to-transparent" style={{ bottom: 'calc(64px + env(safe-area-inset-bottom))' }}>
          <button className="btn" disabled={sending} onClick={doSend}>{sending ? 'Sending…' : 'Send Remarks'}</button>
        </div>
      )}
    </div>
  );
}
