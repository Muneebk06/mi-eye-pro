import { useState } from 'react';
import { Screen } from '../types';
import { COURSES, courseByCode, STUDENT_SESSIONS, StudentSession, Dispute, TOTAL_CAPTURES, PRESENT_THRESHOLD, detectedCaptures, captureTime } from '../data';
import Header from '../components/Header';
import { CaptureGrid } from '../components/Capture';

interface Props {
  navigate: (s: Screen) => void;
  disputes: Dispute[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  course: string;
  setCourse: (c: string) => void;
  onMenu?: () => void;
  initialTab?: 'sessions' | 'disputes';
}

export const DISPUTE_TAG = { pending: 'tag-amber', approved: 'tag-green', rejected: 'tag-red' } as const;
export const DISPUTE_LABEL = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' } as const;

export default function MySessionHistory({ navigate, disputes, selectedId, setSelectedId, course, setCourse, onMenu, initialTab }: Props) {
  const [tab, setTab] = useState<'sessions' | 'disputes'>(initialTab ?? 'sessions');

  const mine = disputes.filter(d => STUDENT_SESSIONS.some(s => s.id === d.sessionId));
  const disputeOf = (id: string) => mine.find(d => d.sessionId === id);
  const statusOf = (s: StudentSession): 'Present' | 'Absent' =>
    s.detected >= PRESENT_THRESHOLD || disputeOf(s.id)?.status === 'approved' ? 'Present' : 'Absent';
  const presentCount = STUDENT_SESSIONS.filter(s => statusOf(s) === 'Present').length;
  const attendancePct = Math.round((presentCount / STUDENT_SESSIONS.length) * 100);

  const Tags = ({ s }: { s: StudentSession }) => {
    const d = disputeOf(s.id);
    return (
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className={`tag ${statusOf(s) === 'Present' ? 'tag-green' : 'tag-red'}`}>{statusOf(s)}</span>
        {d && <span className={`tag ${DISPUTE_TAG[d.status]}`}>Dispute {DISPUTE_LABEL[d.status]}</span>}
      </div>
    );
  };

  const selected = STUDENT_SESSIONS.find(s => s.id === selectedId);
  if (selected) {
    const c = courseByCode(selected.code);
    const d = disputeOf(selected.id);
    const idx = detectedCaptures(`${selected.id}-me`, selected.detected);
    return (
      <div className="pb-6">
        <Header title="Session Details" onBack={() => setSelectedId(null)} />
        <div className="px-4 pt-4 space-y-4">
          <div className="card">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-base font-bold text-gray-900">{c.code} · {c.name}</div>
                <div className="text-sm text-gray-500 mt-1">{selected.date} · {selected.time}</div>
                <div className="text-sm text-gray-500">{c.teacher} · {c.venue}</div>
              </div>
              <Tags s={selected} />
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 text-sm font-semibold text-gray-900">
              Detected in {selected.detected} of {TOTAL_CAPTURES} captures
            </div>
          </div>

          <div className="card">
            <span className="label">Captures where I was detected</span>
            {idx.length
              ? <CaptureGrid seed={selected.id} indexes={idx} time={i => captureTime(selected.time, i)} label="me" />
              : <p className="text-sm text-gray-500">You were not detected in any capture.</p>}
          </div>

          {statusOf(selected) === 'Absent' && !d && <button onClick={() => navigate('raiseDispute')} className="btn">Raise Dispute</button>}
          {d && <button onClick={() => navigate('raiseDispute')} className="btn btn-secondary">View dispute status</button>}
        </div>
      </div>
    );
  }

  const list = STUDENT_SESSIONS.filter(s => course === 'all' || s.code === course);
  const recent = list.slice(0, 3);
  const older = list.slice(3);

  const Row = ({ s, hi }: { s: StudentSession; hi?: boolean }) => (
    <button
      onClick={() => setSelectedId(s.id)}
      className="card w-full text-left active:opacity-80"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="title-card">{s.code} · {courseByCode(s.code).name}</div>
          <div className="text-sm text-gray-600 mt-1">{s.date} · {s.time}</div>
          <div className="text-sm text-gray-600">{courseByCode(s.code).teacher} · {courseByCode(s.code).venue}</div>
        </div>
        <Tags s={s} />
      </div>
    </button>
  );

  return (
    <div className="pb-6">
      <Header title="My Sessions" onMenu={onMenu} />
      <div className="px-4 pt-4 space-y-4">
        <div className="card flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500 font-semibold">Overall attendance</div>
            <div className="text-xs text-gray-500 mt-0.5">{presentCount} of {STUDENT_SESSIONS.length} sessions present</div>
          </div>
          <span className={`text-xl font-extrabold ${attendancePct >= 75 ? 'text-green-700' : 'text-red-700'}`}>{attendancePct}%</span>
        </div>

        <div className="grid seg grid grid-cols-2">
          {([['sessions', 'Sessions'], ['disputes', `My Disputes (${mine.length})`]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className="seg-btn" style={{ background: tab === k ? '#166534' : 'transparent', color: tab === k ? '#fff' : '#64748B' }}>{l}</button>
          ))}
        </div>

        {tab === 'sessions' ? (
          <>
            <select value={course} onChange={e => setCourse(e.target.value)} className="field">
              <option value="all">All courses</option>
              {COURSES.map(c => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
            </select>
            {recent.length > 0 && <div className="space-y-2"><h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Most recent</h3>{recent.map(s => <Row key={s.id} s={s} hi />)}</div>}
            {older.length > 0 && <div className="space-y-2"><h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Earlier</h3>{older.map(s => <Row key={s.id} s={s} />)}</div>}
          </>
        ) : (
          <div className="space-y-2">
            {mine.length === 0 && <div className="card text-sm text-gray-500 text-center">You have not raised any disputes.</div>}
            {mine.map(d => (
              <button key={d.id} onClick={() => { setSelectedId(d.sessionId); navigate('raiseDispute'); }} className="card w-full text-left active:opacity-80">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-gray-900">{d.code} · {courseByCode(d.code).name}</div>
                    <div className="text-xs text-gray-500 mt-1">{d.date} · {d.time}</div>
                    <div className="text-xs text-gray-600 mt-2 line-clamp-2">{d.reason}</div>
                  </div>
                  <span className={`tag ${DISPUTE_TAG[d.status]}`}>{DISPUTE_LABEL[d.status]}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
