import { Screen } from '../types';
import { SHORTAGE, reportRows } from '../data';
import Header from '../components/Header';

export default function AdminDashboard({ navigate, onMenu }: { navigate: (s: Screen) => void; onMenu?: () => void }) {
  const ready = reportRows([]).filter(r => r.status !== 'Not Held').length;
  const links: [string, string, string, Screen][] = [
    ['Reports', `${ready} classes with activity analysis`, '', 'reports'],
    ['Attendance Shortage', `${SHORTAGE.length} students below 75%`, '', 'attendanceShortage'],
    ['Class Archive', 'Attendance evidence by session', '', 'classArchive'],
    ['Analytics', 'Attendance across all classes', '', 'adminAnalytics'],
  ];
  return (
    <div className="pb-6">
      <Header title="Dashboard" showMenu onMenu={onMenu} onNotifications={() => navigate('notifications')} />
      <div className="dashboard-grid admin-grid px-4 pt-4 space-y-4">
        <div>
          <p className="text-gray-500 text-sm">Good morning,</p>
          <h2 className="text-gray-900 text-xl font-bold">Admin Nadia Hussain</h2>
        </div>
        <div className="card">
          <h3 className="label">Today's overview</h3>
          <div className="grid grid-cols-3 gap-2">
            {[['28', 'Classes'], ['12', 'Teachers'], ['450', 'Students']].map(([v, l]) => (
              <div key={l} className="rounded-xl p-3 text-center" style={{ background: '#F8FAFC' }}>
                <div className="text-2xl font-bold text-gray-900">{v}</div>
                <div className="text-xs text-gray-500 mt-0.5">{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card !py-2">
          {links.map(([t, s, , scr]) => (
            <button key={t} onClick={() => navigate(scr)} className="w-full min-h-14 flex items-center justify-between border-t border-gray-100 first:border-0 text-left active:opacity-70">
              <div><div className="text-sm font-semibold text-gray-900">{t}</div><div className="text-xs text-gray-500">{s}</div></div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#64748B" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          ))}
        </div>
        <button onClick={() => navigate('adminPanel')} className="btn">Open Admin Panel</button>
      </div>
    </div>
  );
}
