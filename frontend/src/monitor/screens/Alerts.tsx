import { useState } from 'react';
import Header from '../components/Header';
import { Screen } from '../types';
import { rosterAt } from '../data';

interface Props { navigate: (screen: Screen) => void }
type Category = 'mobile' | 'bunk';

const al = (section: string, i: number, course: string, date: string, time: string, venue = 'Lab3') => ({ ...rosterAt(section, i), course, section, date, time, venue });
const STUDENTS: Record<Category, { name: string; arid: string; course: string; section: string; date: string; time: string; venue: string }[]> = {
  mobile: [
    al('BSCS-5A', 1, 'CS-505', '15 Oct 2026', '11:30 AM'),
    al('BSCS-5A', 6, 'CS-501', '15 Oct 2026', '8:30 AM'),
    al('BSCS-5A', 3, 'CS-505', '13 Oct 2026', '11:30 AM'),
  ],
  bunk: [
    al('BSCS-5B', 16, 'CS-501', '14 Oct 2026', '9:30 AM'),
    al('BSCS-5A', 11, 'CS-505', '13 Oct 2026', '11:30 AM'),
    al('BSSE-3A', 5, 'CS-501', '12 Oct 2026', '10:30 AM'),
  ],
};

export const ALERT_COUNT = Object.values(STUDENTS).reduce((n, l) => n + l.length, 0);

export default function Alerts({ navigate }: Props) {
  const [category, setCategory] = useState<Category>('mobile');
  const list = STUDENTS[category];

  return (
    <div className="pb-6">
      <Header title="Alerts" onBack={() => navigate('dashboard')} />
      <div className="px-4 pt-4 space-y-3">
        <div className="seg grid grid-cols-2">
          <button onClick={() => setCategory('mobile')} className={`seg-btn ${category === 'mobile' ? 'bg-primary text-white' : 'text-gray-500'}`}>Mobile Users</button>
          <button onClick={() => setCategory('bunk')} className={`seg-btn ${category === 'bunk' ? 'bg-primary text-white' : 'text-gray-500'}`}>Bunk Students</button>
        </div>
        {list.map(student => (
          <div key={student.arid} className="card">
            <div className="min-w-0">
              <div className="text-sm font-bold text-gray-900">{student.name}</div>
              <div className="text-xs text-gray-500">Arid No. {student.arid}</div>
            </div>
            <div className="text-xs text-gray-600 mt-2">{student.course} · {student.section}</div>
            <div className="text-xs text-gray-500">{student.date} · {student.time} · {student.venue}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
