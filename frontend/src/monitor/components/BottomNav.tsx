import { Screen, Role } from '../types';
import { Icon, IconName } from './Icons';

interface NavItem { label: string; screen: Screen; icon: IconName }
const item = (label: string, screen: Screen, icon: IconName): NavItem => ({ label, screen, icon });

const NAV: Record<Role, NavItem[]> = {
  teacher: [item('Home', 'dashboard', 'home'), item('Timetable', 'myClasses', 'timetable'), item('Disputes', 'disputes', 'disputes'), item('Shortage', 'attendanceShortage', 'shortage'), item('Archive', 'classArchive', 'archive')],
  student: [item('Home', 'dashboard', 'home'), item('Timetable', 'timetable', 'timetable'), item('My Sessions', 'mySessionHistory', 'sessions')],
  admin: [item('Home', 'dashboard', 'home'), item('Attendance', 'attendance', 'sessions'), item('Reports', 'reports', 'reports'), item('Archive', 'classArchive', 'archive'), item('Admin', 'adminPanel', 'admin')],
  director: [item('Home', 'dashboard', 'home'), item('Reports', 'reports', 'reports')],
};

interface BottomNavProps { current: Screen; role: Role; navigate: (screen: Screen) => void }

export default function BottomNav({ current, role, navigate }: BottomNavProps) {
  return (
    <nav className="role-nav no-print sticky bottom-0 bg-white border-t border-gray-200 z-20 w-full" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="nav-brand"><img src="/biit.png" alt="" /><div><strong>MEye-Pro</strong><small>{role}</small></div></div>
      <div className="nav-items flex items-stretch justify-around px-1 h-16">
        {NAV[role].map(it => {
          const active = current === it.screen || (it.screen === 'attendance' && current === 'studentAttendance');
          return (
            <button key={it.screen} onClick={() => navigate(it.screen)} className="flex-1 min-w-0 flex items-center justify-center active:opacity-70" aria-current={active ? 'page' : undefined}>
              <span className="flex flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 min-h-11" style={{ background: active ? '#F0FDF4' : 'transparent', color: active ? '#166534' : '#64748B' }}>
                <Icon name={it.icon} size={22} />
                <span className="text-[12px] leading-tight whitespace-nowrap" style={{ fontWeight: active ? 600 : 500 }}>{it.label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
