import { useState } from 'react';
import { Screen } from '../types';
import { STUDENT_RECORDS, StudentRecord, DISCIPLINES, SESSIONS, SECTIONS } from '../data';
import Header from '../components/Header';
import { useSticky, matches, SearchBar, FilterChips, FilterSheet, NoResults, FilterGroup, FilterValues } from '../components/Search';
import { ConfirmDialog } from './ManageList';
import { StudentForm } from './RegisterStudent';

const GROUPS: FilterGroup[] = [
  { key: 'discipline', label: 'Discipline', options: DISCIPLINES },
  { key: 'session', label: 'Session', options: SESSIONS },
  { key: 'section', label: 'Section', options: SECTIONS },
  { key: 'status', label: 'Status', options: ['Active', 'Inactive'] },
];
const nb = (s: string) => s.replace(/-/g, '‑');

export default function StudentManagement({ navigate }: { navigate: (s: Screen) => void }) {
  const [items, setItems] = useState<StudentRecord[]>(STUDENT_RECORDS);
  const [q, setQ] = useSticky('studentMgmt.q', '');
  const [filters, setFilters] = useSticky<FilterValues>('studentMgmt.filters', {});
  const [sheet, setSheet] = useState(false);
  const [editing, setEditing] = useState<StudentRecord | 'new' | null>(null);
  const [confirm, setConfirm] = useState<StudentRecord | null>(null);

  if (editing) {
    const isNew = editing === 'new';
    return (
      <div>
        <Header title={isNew ? 'Add Student' : 'Edit Student'} onBack={() => setEditing(null)} />
        <StudentForm
          initial={isNew ? undefined : editing}
          onSave={v => {
            const rec = { name: v.name, arid: v.arid, discipline: v.discipline, session: v.session, section: v.section };
            if (isNew) setItems(p => [{ ...rec, status: 'Active' }, ...p]);
            else setItems(p => p.map(r => (r.arid === editing.arid ? { ...r, ...rec } : r)));
            setEditing(null);
          }}
        />
      </div>
    );
  }

  const list = items.filter(r => matches(q, r.name, r.arid) && GROUPS.every(g => !filters[g.key] || (g.key === 'status' ? r.status : (r as unknown as Record<string, string>)[g.key]) === filters[g.key]));
  const active = Object.values(filters).filter(Boolean).length;
  const clear = () => { setQ(''); setFilters({}); };
  const toggle = (r: StudentRecord) => setItems(p => p.map(x => (x.arid === r.arid ? { ...x, status: x.status === 'Active' ? 'Inactive' : 'Active' } : x)));

  return (
    <div className="pb-24">
      <Header title="Student Management" onBack={() => navigate('adminPanel')} />
      <div className="px-4 pt-4 space-y-3">
        <SearchBar value={q} onChange={setQ} placeholder="Search name or Arid No." count={list.length} noun="student" filterCount={active} onFilters={() => setSheet(true)} />
        <FilterChips groups={GROUPS} values={filters} onRemove={k => setFilters(f => ({ ...f, [k]: '' }))} />
        <button className="btn" onClick={() => setEditing('new')}>Add Student</button>
        {list.length === 0 && <NoResults onClear={clear} />}
        {list.map(r => (
          <div key={r.arid} className="card !p-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-green-100 text-green-800 font-bold flex items-center justify-center flex-shrink-0">{r.name[0]}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-gray-900 truncate">{r.name}</div>
                <div className="text-xs text-gray-600 mt-0.5 whitespace-nowrap">{nb(r.arid)}</div>
                <div className="text-xs text-gray-500 mt-0.5">{nb(r.section)} · {r.session}</div>
              </div>
              <span className={`tag ${r.status === 'Active' ? 'tag-green' : 'tag-red'}`}>{r.status}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button className="btn btn-secondary" onClick={() => setEditing(r)}>Edit</button>
              <button className={`btn ${r.status === 'Active' ? 'btn-danger' : 'btn-secondary'}`} onClick={() => (r.status === 'Active' ? setConfirm(r) : toggle(r))}>
                {r.status === 'Active' ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>
      <FilterSheet open={sheet} groups={GROUPS} values={filters} onApply={setFilters} onClose={() => setSheet(false)} />
      {confirm && <ConfirmDialog title={`Deactivate ${confirm.name}?`} onCancel={() => setConfirm(null)} onConfirm={() => { toggle(confirm); setConfirm(null); }} />}
    </div>
  );
}
