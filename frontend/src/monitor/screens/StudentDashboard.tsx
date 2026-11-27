import { Screen } from '../types';
import { STUDENT } from '../data';
import Header from '../components/Header';
import Bar from '../components/Bar';
import { Icon } from '../components/Icons';

const ATT = [
  { code: 'CS-501', name: 'Software Engineering', v: 85 },
  { code: 'CS-502', name: 'Data Structures', v: 73 },
  { code: 'CS-503', name: 'Computer Networks', v: 91 },
  { code: 'CS-504', name: 'Operating Systems', v: 88 },
  { code: 'CS-505', name: 'Artificial Intelligence', v: 79 },
  { code: 'HU-101', name: 'Pakistan Studies', v: 94 },
];

export default function StudentDashboard({ navigate, onOpenCourse, onMenu }: { navigate: (s: Screen) => void; onMenu: () => void; onOpenCourse: (code: string) => void }) {
  
  return (
    <div className="pb-6">
      <Header title="Dashboard" showMenu onMenu={onMenu} onNotifications={() => navigate('notifications')} hero={<div><p className="text-sm text-white/90">Good morning,</p><h2 className="text-white text-[22px] font-bold leading-tight">{STUDENT.name}</h2><p className="text-xs text-white/90 mt-0.5">Arid No. {STUDENT.arid}</p></div>} />
      <div className="dashboard-grid px-4 -mt-6 relative z-30 space-y-3">
        <div className="card" style={{ borderLeft: '4px solid #166534' }}>
          <h3 className="label !mb-1 !text-gray-600">Next class</h3>
          <div className="stat">9:00 AM</div>
          <div className="title-card mt-1">CS-501 · Software Engineering</div>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
            <span className="flex items-center gap-1"><Icon name="pin" size={16} />Lab3</span>
            <span className="flex items-center gap-1"><Icon name="user" size={16} />Mr. Umar Farooq</span>
          </div>
        </div>

        <div className="card space-y-4">
          <div>
            <h3 className="title-card">My attendance</h3>
          </div>
          {ATT.map(a => {
            const low = a.v < 75;
            return (
              <button key={a.code} onClick={() => onOpenCourse(a.code)} className="block w-full text-left active:opacity-70">
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-3 mb-2">
                  <span className="text-sm min-w-0"><b className="font-semibold text-gray-900">{a.code}</b> <span className="text-gray-600">{a.name}</span></span>
                  <span className="text-sm font-semibold text-gray-900 w-12 text-right flex-shrink-0" style={low ? { color: '#B91C1C' } : undefined}>{a.v}%</span>
                  <span className="text-gray-400 flex-shrink-0"><Icon name="chevron" size={18} /></span>
                </div>
                <Bar value={a.v} />
                {low && <div className="mt-2"><span className="tag tag-red">Below 75%</span></div>}
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
