import { useState } from 'react';
import { Screen } from '../types';
import { courseByCode, StudentSession, Dispute, TOTAL_CAPTURES, detectedCaptures, captureTime } from '../data';
import Header from '../components/Header';
import { CaptureGrid } from '../components/Capture';

interface Props {
  navigate: (s: Screen) => void;
  session: StudentSession | undefined;
  dispute: Dispute | undefined;
  onSubmit: (s: StudentSession, reason: string, hasPhoto: boolean) => void;
}

function Tracker({ d }: { d: Dispute }) {
  const decided = d.status !== 'pending';
  const steps = [
    { label: 'Submitted', state: 'done' },
    { label: 'Under Teacher Review', state: decided ? 'done' : 'active' },
    { label: decided ? (d.status === 'approved' ? 'Approved' : 'Rejected') : 'Approved / Rejected', state: decided ? (d.status === 'approved' ? 'ok' : 'bad') : 'todo' },
  ];
  const color = (s: string) => s === 'bad' ? '#B91C1C' : s === 'todo' ? '#CBD5E1' : s === 'active' ? '#D97706' : '#166534';
  return (
    <div className="card">
      <span className="label">Dispute status</span>
      {steps.map((s, i) => (
        <div key={s.label} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] text-white font-bold" style={{ background: color(s.state) }}>
              {s.state === 'todo' ? '' : s.state === 'bad' ? '✕' : s.state === 'active' ? '•' : '✓'}
            </div>
            {i < steps.length - 1 && <div className="w-0.5 h-6" style={{ background: color(steps[i + 1].state === 'todo' ? 'todo' : 'done') }} />}
          </div>
          <div className="text-sm pb-4 font-semibold" style={{ color: s.state === 'todo' ? '#64748B' : '#111827' }}>{s.label}</div>
        </div>
      ))}
      {decided && (
        <div className="rounded-xl p-3 mt-1" style={{ background: d.status === 'approved' ? '#F0FDF4' : '#FEE2E2' }}>
          <div className="text-xs font-bold text-gray-500">Teacher's comment</div>
          <p className="text-sm text-gray-800 mt-1">{d.comment || 'No comment provided.'}</p>
          {d.status === 'approved' && <p className="text-xs font-bold text-green-700 mt-2">Your attendance for this session is now Present.</p>}
        </div>
      )}
    </div>
  );
}

export default function RaiseDispute({ navigate, session, dispute, onSubmit }: Props) {
  const [reason, setReason] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const back = () => navigate('mySessionHistory');

  if (!session) { return <div className="p-4"><button onClick={back} className="btn">Back to My Sessions</button></div>; }
  const c = courseByCode(session.code);
  const idx = detectedCaptures(`${session.id}-me`, session.detected);

  return (
    <div className="pb-6">
      <Header title={dispute ? 'My Dispute' : 'Raise Dispute'} onBack={back} />
      <div className="px-4 pt-4 space-y-4">
        <div className="card">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-gray-900">{c.code} · {c.name}</div>
              <div className="text-xs text-gray-500 mt-1">{session.date} · {session.time} · {c.venue}</div>
              <div className="text-xs text-gray-500">{c.teacher}</div>
            </div>
            <span className="tag tag-red">Absent</span>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 text-sm font-semibold text-gray-900">Detected in {session.detected} of {TOTAL_CAPTURES} captures</div>
          <div className="mt-3">
            {idx.length ? <CaptureGrid seed={session.id} indexes={idx} time={i => captureTime(session.time, i)} label="me" /> : <p className="text-sm text-gray-500">No captures detected you.</p>}
          </div>
        </div>

        {dispute ? (
          <>
            <div className="card">
              <span className="label">Your reason</span>
              <p className="text-sm text-gray-800">{dispute.reason}</p>
              {dispute.hasPhoto && <p className="text-xs text-green-700 font-semibold mt-2">Photo attached</p>}
            </div>
            <Tracker d={dispute} />
          </>
        ) : (
          <>
            <div className="card space-y-4">
              <div>
                <label className="label">Reason (required)</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={200} rows={3} placeholder="Briefly explain why you were present" className="field py-3" />
              </div>
              <div>
                <span className="label">Photo (optional)</span>
                <label className="field flex items-center text-gray-500 cursor-pointer">
                  {photo ?? 'Attach a photo'}
                  <input type="file" accept="image/*" className="hidden" onChange={e => setPhoto(e.target.files?.[0]?.name ?? null)} />
                </label>
              </div>
            </div>
            <button disabled={!reason.trim()} onClick={() => onSubmit(session, reason.trim(), !!photo)} className="btn">Submit Dispute</button>
          </>
        )}
      </div>
    </div>
  );
}
