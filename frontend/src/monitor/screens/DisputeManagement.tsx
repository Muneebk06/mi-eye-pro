import { useState } from 'react';
import { Screen } from '../types';
import { Dispute, TOTAL_CAPTURES, detectedCaptures, captureTime, courseByCode, isOwn } from '../data';
import Header from '../components/Header';
import { Icon } from '../components/Icons';
import { CaptureGrid } from '../components/Capture';

interface Props {
  navigate: (s: Screen) => void;
  onMenu: () => void;
  disputes: Dispute[];
  onDecide: (id: string, decision: 'approved' | 'rejected', comment: string) => void;
}

export default function DisputeManagement({ navigate, onMenu, disputes, onDecide }: Props) {
  const [comments, setComments] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [evidence, setEvidence] = useState<Dispute | null>(null);

  const list = disputes.filter(d => isOwn(d.code) && d.status === 'pending');

  const decide = (d: Dispute, decision: 'approved' | 'rejected') => {
    const c = (comments[d.id] ?? '').trim();
    if (decision === 'rejected' && !c) { setError(d.id); return; }
    setError('');
    onDecide(d.id, decision, c);
  };

  return (
    <div className="pb-6">
      <Header title="Disputes" onMenu={onMenu} />
      <div className="px-4 pt-4 space-y-3">
        {list.length === 0 && <div className="card text-sm text-gray-500 text-center">No pending disputes.</div>}
        {list.map(d => {
          const c = courseByCode(d.code);
          return (
            <div key={d.id} className="card space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-gray-900">{d.student}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Arid No. {d.arid}</div>
                  <div className="text-xs text-gray-500 mt-1">{d.code} · {c.name}</div>
                  <div className="text-xs text-gray-500">{d.date} · {d.time} · {c.venue}</div>
                </div>
                <button onClick={() => setEvidence(d)} aria-label={`View evidence for ${d.student}`} className="w-10 h-10 rounded-full bg-green-50 text-primary flex items-center justify-center flex-shrink-0"><Icon name="info" size={20} /></button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-600">Detected {d.detected}/{TOTAL_CAPTURES}</span>
              </div>
              <textarea
                rows={2}
                value={comments[d.id] ?? ''}
                onChange={e => { setComments(p => ({ ...p, [d.id]: e.target.value })); if (error === d.id) setError(''); }}
                className="field py-2 min-h-16"
                placeholder="Teacher comment"
              />
              {error === d.id && <p className="text-xs text-red-700 font-semibold">Comment required to reject.</p>}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => decide(d, 'rejected')} className="btn btn-danger !min-h-10">Reject</button>
                <button onClick={() => decide(d, 'approved')} className="btn !min-h-10">Approve</button>
              </div>
            </div>
          );
        })}
      </div>
      {evidence && (() => {
        const indexes = detectedCaptures(`${evidence.sessionId}-${evidence.arid}`, evidence.detected);
        return (
          <div className="fixed inset-0 z-50 bg-gray-900/50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Evidence frames">
            <button className="absolute inset-0" onClick={() => setEvidence(null)} aria-label="Close evidence" />
            <div className="relative bg-white rounded-t-2xl w-full max-w-[430px] p-4 pb-6">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div><div className="text-sm font-bold text-gray-900">{evidence.student}</div><div className="text-xs text-gray-500">Evidence frames</div></div>
                <button className="w-10 h-10 rounded-full bg-gray-100 text-gray-600" onClick={() => setEvidence(null)} aria-label="Close">×</button>
              </div>
              {indexes.length ? <CaptureGrid seed={evidence.sessionId} indexes={indexes} time={i => captureTime(evidence.time, i)} label="s" square /> : <div className="text-sm text-gray-500 py-4">No detections.</div>}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
