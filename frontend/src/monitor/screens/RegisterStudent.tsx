import { useState } from 'react';
import { Screen } from '../types';
import { SECTION_COURSES, SECTIONS, SESSIONS, DISCIPLINES, ARID_RE, StudentRecord } from '../data';
import Header from '../components/Header';
import PhotoGrid, { avatarUrl } from '../components/PhotoGrid';

function Select({ value, onChange, options, placeholder, invalid, onBlur }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string; invalid?: boolean; onBlur?: () => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} onBlur={onBlur} aria-invalid={invalid} className="field" style={{ color: value ? '#0F172A' : '#64748B' }}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

const Err = ({ msg }: { msg?: string }) => (msg ? <p className="text-xs font-semibold text-red-700 mt-1">{msg}</p> : null);

export interface StudentFormValue { arid: string; name: string; discipline: string; session: string; section: string; photos: (string | null)[] }

export const seedPhotos = (name: string) => [150, 160, 170, 180].map(h => avatarUrl(name, h));

interface FormProps { initial?: StudentRecord; onSave: (v: StudentFormValue) => void; saveLabel?: string }

export function StudentForm({ initial, onSave, saveLabel }: FormProps) {
  const editing = !!initial;
  const [photos, setPhotos] = useState<(string | null)[]>(initial ? seedPhotos(initial.name) : [null, null, null, null]);
  const [arid, setArid] = useState(initial?.arid ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [discipline, setDiscipline] = useState(initial?.discipline ?? '');
  const [session, setSession] = useState(initial?.session ?? '');
  const [section, setSection] = useState(initial?.section ?? '');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [tried, setTried] = useState(false);
  const t = (k: string) => () => setTouched(p => ({ ...p, [k]: true }));
  const show = (k: string) => tried || touched[k];

  const errs: Record<string, string> = {};
  if (photos.some(p => !p)) errs.photos = 'All 4 face photos are required.';
  if (!arid.trim()) errs.arid = 'Arid No. is required.';
  else if (!ARID_RE.test(arid.trim())) errs.arid = 'Arid No. must match the format 2023-ARID-3855.';
  if (!name.trim()) errs.name = 'Student name is required.';
  if (!discipline) errs.discipline = 'Select a discipline.';
  if (!session) errs.session = 'Select a session.';
  if (!section) errs.section = 'Select a section.';
  if (!editing && !password) errs.password = 'Password is required.';
  const valid = Object.keys(errs).length === 0;
  const e = (k: string) => (show(k) ? errs[k] : undefined);

  const submit = () => {
    setTried(true);
    if (!valid) return;
    onSave({ arid: arid.trim().toUpperCase(), name: name.trim(), discipline, session, section, photos });
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
        <div>
          <label className="label">Arid No.</label>
          <input value={arid} onChange={ev => setArid(ev.target.value)} onBlur={t('arid')} aria-invalid={!!e('arid')} placeholder="2023-ARID-3855" className="field" />
          <Err msg={e('arid')} />
        </div>
        <div>
          <label className="label">Student Name</label>
          <input value={name} onChange={ev => setName(ev.target.value)} onBlur={t('name')} aria-invalid={!!e('name')} placeholder="Full name" className="field" />
          <Err msg={e('name')} />
        </div>
        <div>
          <label className="label">Discipline</label>
          <Select value={discipline} onChange={setDiscipline} onBlur={t('discipline')} invalid={!!e('discipline')} options={DISCIPLINES} placeholder="Select discipline" />
          <Err msg={e('discipline')} />
        </div>
        <div>
          <label className="label">Session</label>
          <Select value={session} onChange={setSession} onBlur={t('session')} invalid={!!e('session')} options={SESSIONS} placeholder="Select session" />
          <Err msg={e('session')} />
        </div>
        <div>
          <label className="label">Section</label>
          <Select value={section} onChange={setSection} onBlur={t('section')} invalid={!!e('section')} options={SECTIONS} placeholder="Select section" />
          <Err msg={e('section')} />
          <p className="text-xs text-gray-500 mt-2">Auto-enrolled in this section's courses{section ? ` (${SECTION_COURSES[section].length})` : ''}</p>
        </div>
        <div>
          <label className="label">Password</label>
          <input type="password" value={password} onChange={ev => setPassword(ev.target.value)} onBlur={t('password')} aria-invalid={!!e('password')} placeholder={editing ? 'Leave blank to keep current' : 'Set a password'} className="field" />
          <Err msg={e('password')} />
        </div>
      </div>

      <button onClick={submit} disabled={!valid} className="btn">{saveLabel ?? (editing ? 'Save Student' : 'Register Student')}</button>
    </div>
  );
}

export default function RegisterStudent({ navigate }: { navigate: (s: Screen) => void }) {
  const [banner, setBanner] = useState('');
  const [k, setK] = useState(0);
  return (
    <div>
      <Header title="Register Student" onBack={() => navigate('adminPanel')} />
      {banner && <div className="mx-4 mt-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-semibold p-4">{banner}</div>}
      <StudentForm key={k} onSave={v => { setBanner(`Added ${v.arid} · Enrolled in ${SECTION_COURSES[v.section].length} courses`); setK(x => x + 1); }} />
    </div>
  );
}
