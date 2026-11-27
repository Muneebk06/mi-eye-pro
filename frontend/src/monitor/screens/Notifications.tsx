import { useState } from 'react';
import { Screen, Role } from '../types';
import { TEACHER, Notice, NoticeType, NOTICE_LABEL, SEED_NOTICES, ago, noticeVisible } from '../data';
import { useSwaps } from '../SwapContext';
import { SwapActions } from './MySwaps';
import { useRemarks } from '../RemarkContext';
import Header from '../components/Header';

interface Props { navigate: (s: Screen) => void; role: Role; extra: Notice[]; onOpenRemark: (id: string) => void }

const STYLE: Record<NoticeType, { bg: string; color: string }> = {
  report: { bg: '#DCFCE7', color: '#166534' },
  shortage: { bg: '#FEF3C7', color: '#92400E' },
  timetable: { bg: '#DBEAFE', color: '#1D4ED8' },
  dispute: { bg: '#F1F5F9', color: '#475569' },
  swap: { bg: '#FEF3C7', color: '#92400E' },
  change: { bg: '#DBEAFE', color: '#1D4ED8' },
  remark: { bg: '#DCFCE7', color: '#166534' },
};
const FILTERS: ('all' | NoticeType)[] = ['all', 'remark', 'swap', 'change', 'timetable', 'shortage', 'dispute', 'report'];

export default function Notifications({ navigate, role, extra, onOpenRemark }: Props) {
  const { swaps, decide } = useSwaps();
  const { remarks } = useRemarks();
  const [filter, setFilter] = useState<'all' | NoticeType>('all');
  const feed = [...extra, ...SEED_NOTICES.filter(n => noticeVisible(n, role))]
    .sort((a, b) => a.mins - b.mins)
    .filter(n => filter === 'all' || n.type === filter);

  return (
    <div className="pb-6">
      <Header title="Notifications" onBack={() => navigate(role === 'teacher' ? 'myClasses' : 'dashboard')} />
      <div className="px-4 pt-4 space-y-3">
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="flex-shrink-0 min-h-11 px-4 rounded-full text-xs font-bold"
              style={{ background: filter === f ? '#166534' : '#fff', color: filter === f ? '#fff' : '#64748B', border: '1px solid #E2E8F0' }}
            >
              {f === 'all' ? 'All' : NOTICE_LABEL[f]}
            </button>
          ))}
        </div>
        {feed.length === 0 && <div className="card text-sm text-gray-500 text-center">No notifications.</div>}
        {feed.map(n => (
          <div key={n.id} className="card" {...(n.remarkId ? { role: 'button', tabIndex: 0, onClick: () => onOpenRemark(n.remarkId!), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') onOpenRemark(n.remarkId!); }, style: { cursor: 'pointer' } } : {})}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span className="tag" style={STYLE[n.type]}>{NOTICE_LABEL[n.type]}</span>
                {n.remarkId && remarks.find(m => m.id === n.remarkId)?.status === 'delivered' && <span className="w-2 h-2 rounded-full bg-red-500" aria-label="Unread" />}
              </span>
              <span className="text-xs text-gray-500">{ago(n.mins)}</span>
            </div>
            <div className="text-sm font-bold text-gray-900 mt-2">{n.title}</div>
            <p className="text-sm text-gray-600 mt-1">{n.body}</p>
            {n.swapId && n.type === 'swap' && (() => {
              const w = swaps.find(x => x.id === n.swapId);
              if (!w || w.toTeacher !== TEACHER || n.title !== 'Swap request') return null;
              return w.status === 'pending'
                ? <SwapActions swap={w} onDecide={d => decide(w.id, d)} />
                : <span className={`tag mt-3 ${w.status === 'accepted' ? 'tag-green' : 'tag-red'}`}>{w.status === 'accepted' ? 'Accepted' : 'Declined'}</span>;
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}
