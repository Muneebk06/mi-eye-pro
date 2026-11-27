import { useState } from 'react';
import { Screen } from '../types';
import { COURSES, DEPARTMENTS, TEACHER_RECORDS, TeacherRecord } from '../data';
import Header from '../components/Header';
import PhotoGrid, { avatarUrl } from '../components/PhotoGrid';
import { useSticky, matches, SearchBar, FilterChips, FilterSheet, NoResults, FilterGroup, FilterValues } from '../components/Search';
import { ConfirmDialog } from './ManageList';

type T = TeacherRecord & { photos: (string | null)[] };
const SEED: T[] = TEACHER_RECORDS.map((t, i) => ({ ...t, photos: [0, 1, 2, 3].map(k => avatarUrl(t.name, 140 + i * 30 + k * 6)) }));
const nb = (s: string) => s.replace(/-/g, '‑');
const GROUPS: FilterGroup[] = [
  { key: 'department', label: 'Department', options: DEPARTMENTS },
  { key: 'status', label: 'Status', options: ['Active', 'Inactive'] },
  { key: 'course', label: 'Course', options: COURSES.map(c => c.code) },
];
const Err = ({ msg }: { msg?: string }) => (msg ? <p className="text-xs font-semibold text-red-700 mt-1">{msg}</p> : null);

function TeacherForm({ initial, onSave }: { initial?: T; onSave: (t: Omit<T, 'id'>) => void }) {
  const editing = !!initial;
  const [photos, setPhotos] = useState<(string | null)[]>(initial?.photos ?? [null, null, null, null]);
  const [name, setName] = useState(initial?.name ?? '');
  const [empNo, setEmpNo] = useState(initial?.empNo ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [department, setDepartment] = useState(initial?.department ?? '');
  const [courses, setCourses] = useState<string[]>(initial?.courses ?? []);
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>(initial?.status ?? 'Active');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [tried, setTried] = useState(false);
  const t = (k: string) => () => setTouched(p => ({ ...p, [k]: true }));
  const errs: Record<string, string> = {};
  if (photos.some(p => !p)) errs.photos = 'All 4 face photos are required.';
  if (!name.trim()) errs.name = 'Name is required.';
  if (!empNo.trim()) errs.empNo = 'Employee No. is required.';
  if (!email.trim()) errs.email = 'Email is required.';
  else if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = 'Enter a valid email address.';
  if (!department) errs.department = 'Select a department.';
  if (!editing && !password) errs.password = 'Password is required.';
  const valid = !Object.keys(errs).length;
  const e = (k: string) => (tried || touched[k] ? errs[k] : undefined);
  const submit = () => {
    setTried(true);
    if (!valid) return;
    onSave({ name: name.trim(), empNo: empNo.trim(), email: email.trim(), department, courses, status, photos });
  };
  return (
    <div className="px-4 pt-4 pb-24 space-y-4">
      <div className="card">
        <span className="label">Face photos (4 required)</span>
        <PhotoGrid value={photos} onChange={v => { setPhotos(v); t('photos')(); }} columns={2} />
        <p className="text-xs text-gray-500 mt-2">Used for face recognition</p>
        <Err msg={e('photos')} />
      </div>
      <div className="card space-y-4">
        <div><label className="label">Name</label><input className="field" value={name} onChange={x => setName(x.target.value)} onBlur={t('name')} aria-invalid={!!e('name')} /><Err msg={e('name')} /></div>
        <div><label className="label">Employee No.</label><input className="field" value={empNo} placeholder="EMP-1000" onChange={x => setEmpNo(x.target.value)} onBlur={t('empNo')} aria-invalid={!!e('empNo')} /><Err msg={e('empNo')} /></div>
        <div><label className="label">Email</label><input className="field" type="email" value={email} onChange={x => setEmail(x.target.value)} onBlur={t('email')} aria-invalid={!!e('email')} /><Err msg={e('email')} /></div>
        <div>
          <label className="label">Department</label>
          <select className="field" value={department} onChange={x => setDepartment(x.target.value)} onBlur={t('department')} aria-invalid={!!e('department')}>
            <option value="">Select</option>{DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
          </select>
          <Err msg={e('department')} />
        </div>
        <div><label className="label">Password</label><input className="field" type="password" value={password} placeholder={editing ? 'Leave blank to keep current' : undefined} onChange={x => setPassword(x.target.value)} onBlur={t('password')} aria-invalid={!!e('password')} /><Err msg={e('password')} /></div>
        <div>
          <label className="label">Status</label>
          <select className="field" value={status} onChange={x => setStatus(x.target.value as 'Active' | 'Inactive')}><option>Active</option><option>Inactive</option></select>
        </div>
      </div>
      <button className="btn" disabled={!valid} onClick={submit}>Save Teacher</button>
    </div>
  );
}

export default function TeacherManagement({ navigate }: { navigate: (s: Screen) => void }) {
  const [items, setItems] = useState<T[]>(SEED);
  const [q, setQ] = useSticky('teacherMgmt.q', '');
  const [filters, setFilters] = useSticky<FilterValues>('teacherMgmt.filters', {});
  const [sheet, setSheet] = useState(false);
  const [editing, setEditing] = useState<T | 'new' | null>(null);
  const [confirm, setConfirm] = useState<T | null>(null);

  if (editing) {
    const isNew = editing === 'new';
    return (
      <div>
        <Header title={isNew ? 'Add Teacher' : 'Edit Teacher'} onBack={() => setEditing(null)} />
        <TeacherForm initial={isNew ? undefined : editing} onSave={v => {
          if (isNew) setItems(p => [{ ...v, id: `n${Date.now()}` }, ...p]);
          else setItems(p => p.map(r => (r.id === editing.id ? { ...r, ...v } : r)));
          setEditing(null);
        }} />
      </div>
    );
  }

  const list = items.filter(r => matches(q, r.name, r.empNo, r.email)
    && (!filters.department || r.department === filters.department)
    && (!filters.status || r.status === filters.status)
    && (!filters.course || r.courses.includes(filters.course)));
  const active = Object.values(filters).filter(Boolean).length;
  const toggle = (r: T) => setItems(p => p.map(x => (x.id === r.id ? { ...x, status: x.status === 'Active' ? 'Inactive' : 'Active' } : x)));

  return (
    <div className="pb-24">
      <Header title="Teacher Management" onBack={() => navigate('adminPanel')} />
      <div className="px-4 pt-4 space-y-3">
        <SearchBar value={q} onChange={setQ} placeholder="Search name, Employee No. or email" count={list.length} noun="teacher" filterCount={active} onFilters={() => setSheet(true)} />
        <FilterChips groups={GROUPS} values={filters} onRemove={k => setFilters(f => ({ ...f, [k]: '' }))} />
        <button className="btn" onClick={() => setEditing('new')}>Add Teacher</button>
        {list.length === 0 && <NoResults onClear={() => { setQ(''); setFilters({}); }} />}
        {list.map(r => (
          <div key={r.id} className="card !p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-bold text-gray-900 min-w-0">{r.name}</div>
              <span className={`tag ${r.status === 'Active' ? 'tag-green' : 'tag-red'}`}>{r.status}</span>
            </div>
            <div className="text-xs text-gray-600 mt-1"><span className="whitespace-nowrap">{nb(r.empNo)}</span> · {r.department}</div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {r.courses.map(c => <span key={c} className="tag tag-neutral !text-xs !px-2 whitespace-nowrap">{nb(c)}</span>)}
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
