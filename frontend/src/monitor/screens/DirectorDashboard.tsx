import { Screen } from '../types';
import { SHORTAGE, reportRows, TREND, SECTIONS, avg, heldPct } from '../data';
import Header from '../components/Header';
import MenuList from '../components/MenuList';

import { IconName } from '../components/Icons';
const ICON: Record<string, IconName> = { Reports: 'reports', 'Attendance Shortage': 'shortage', 'Class Archive': 'archive' };

export default function DirectorDashboard({ navigate, onMenu }: { navigate: (s: Screen) => void; onMenu: () => void }) {
  const overall = avg(SECTIONS.map(s => avg(TREND[s])));
  const stats: [string, string][] = [
    ['Overall attendance', `${overall}%`],
    ['Classes held', `${heldPct(reportRows([]))}%`],
    ['Below threshold', String(SHORTAGE.length)],
  ];
  const links: [string, string, Screen][] = [
    ['Reports', 'Class Held Report and Class Activity', 'reports'],
    ['Attendance Shortage', `${SHORTAGE.length} students below 75%`, 'attendanceShortage'],
    ['Class Archive', 'View attendance evidence', 'classArchive'],
  ];
  return (
    <div className="pb-6">
      <Header title="Dashboard" showMenu onMenu={onMenu} onNotifications={() => navigate('notifications')} hero={<div><p className="text-sm text-white/90">Good morning,</p><h2 className="text-white text-[22px] font-bold leading-tight">Director Tariq Mehmood</h2></div>} />
      <div className="dashboard-grid px-4 -mt-6 relative z-30 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          {stats.map(([l, v]) => {
            const bad = l === 'Below threshold';
            return (
              <div key={l} className="card !p-3 text-center">
                <div className="text-2xl font-bold text-gray-900">{v}</div>
                {bad && <div className="mt-1 flex justify-center"><span className="tag tag-red !text-xs !px-2 !whitespace-normal text-center leading-tight">Below threshold</span></div>}
                {!bad && <div className="text-xs text-gray-500 mt-1 leading-tight">{l}</div>}
              </div>
            );
          })}
        </div>
        <MenuList items={links.map(([title, sub, scr]) => ({ title, sub, icon: ICON[title], onClick: () => navigate(scr) }))} />
      </div>
    </div>
  );
}
