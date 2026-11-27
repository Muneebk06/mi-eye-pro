import { Screen } from '../types';
import Header from '../components/Header';

function Row({ label, sub, onClick }: { label: string; sub?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full min-h-14 flex items-center justify-between py-2 border-t border-gray-200 first:border-0 text-left active:opacity-70">
      <div>
        <div className="title-card !text-[15px]">{label}</div>
        {sub && <div className="text-sm text-gray-600 mt-0.5">{sub}</div>}
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#64748B" strokeWidth="2" strokeLinecap="round" /></svg>
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card !py-2">
      <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider pt-2 pb-2">{title}</h3>
      {children}
    </div>
  );
}

export default function AdminPanel({ navigate, onMenu }: { navigate: (s: Screen) => void; onMenu?: () => void }) {
  return (
    <div className="pb-6">
      <Header title="Admin Panel" onBack={onMenu ? undefined : () => navigate('dashboard')} onMenu={onMenu} />
      <div className="px-4 pt-4 space-y-3">
        <Section title="Data">
          <Row label="Upload" sub="Timetable Excel file" onClick={() => navigate('upload')} />
          <Row label="Timetable" sub="Weekly recurring schedule" onClick={() => navigate('timetable')} />
        </Section>
        <Section title="People">
          <Row label="Teacher Management" sub="Add, edit, deactivate teachers" onClick={() => navigate('teacherMgmt')} />
          <Row label="Student Management" sub="Add, edit, deactivate students" onClick={() => navigate('studentMgmt' as Screen)} />
          <Row label="Admin Management" sub="Admin and Director accounts" onClick={() => navigate('adminMgmt')} />
        </Section>
        <Section title="Devices">
          <Row label="Camera Management" sub="Venue and camera position" onClick={() => navigate('cameraMgmt')} />
        </Section>
        <Section title="Insights">
          <Row label="Analytics" sub="Attendance across all classes" onClick={() => navigate('adminAnalytics')} />
          <Row label="Attendance Shortage" sub="Students below 75%" onClick={() => navigate('attendanceShortage')} />
        </Section>
      </div>
    </div>
  );
}
