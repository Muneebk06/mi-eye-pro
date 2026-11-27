import { useState } from 'react';
import Header from '../components/Header';
import { useSticky, matches, SearchBar, FilterChips, FilterSheet, NoResults, FilterGroup, FilterValues } from '../components/Search';

export function ConfirmDialog({ title, onCancel, onConfirm, confirmLabel = 'Deactivate' }: { title: string; onCancel: () => void; onConfirm: () => void; confirmLabel?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" role="alertdialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-gray-900/50" onClick={onCancel} aria-label="Cancel" />
      <div className="relative w-full max-w-[340px] bg-white rounded-2xl p-5">
        <h3 className="title-section">{title}</h3>
        <p className="text-sm text-gray-600 mt-2">They will no longer be able to sign in or be marked in attendance. You can activate again later.</p>
        <div className="grid grid-cols-2 gap-3 mt-5">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn" style={{ background: '#B91C1C', borderColor: '#B91C1C' }} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export interface Field { key: string; label: string; type?: 'text' | 'email' | 'password' | 'select'; options?: string[]; required?: boolean; placeholder?: string }
export type Rec = Record<string, string> & { id: string; status: 'Active' | 'Inactive' };

interface Props {
  title: string; noun: string; onBack: () => void;
  fields: Field[]; items: Rec[]; setItems: (f: (p: Rec[]) => Rec[]) => void;
  primary: (r: Rec) => string; secondary: (r: Rec) => string;
  stickyKey: string; searchPlaceholder: string; searchKeys: string[]; filterGroups: { key: string; label: string; options: string[] }[];
}

export default function ManageList({ title, noun, onBack, fields, items, setItems, primary, secondary, stickyKey, searchPlaceholder, searchKeys, filterGroups }: Props) {
  const [q, setQ] = useSticky(`${stickyKey}.q`, '');
  const [filters, setFilters] = useSticky<FilterValues>(`${stickyKey}.filters`, {});
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState<Rec | null>(null);
  const [editing, setEditing] = useState<Rec | 'new' | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<string[]>([]);

  const begin = (r: Rec | 'new') => {
    setEditing(r);
    setForm(r === 'new' ? { status: 'Active' } : { ...r, password: '' });
    setErrors([]);
  };

  const save = () => {
    const e: string[] = [];
    fields.forEach(f => {
      const v = (form[f.key] ?? '').trim();
      const needed = f.required !== false && !(f.type === 'password' && editing !== 'new');
      if (needed && !v) e.push(`${f.label} is required.`);
      else if (f.type === 'email' && v && !/^\S+@\S+\.\S+$/.test(v)) e.push('Enter a valid email address.');
    });
    setErrors(e);
    if (e.length) return;
    if (editing === 'new') setItems(p => [{ ...form, id: `n${Date.now()}`, status: (form.status as Rec['status']) || 'Active' } as Rec, ...p]);
    else if (editing) setItems(p => p.map(r => r.id === (editing as Rec).id ? { ...r, ...form, password: '' } as Rec : r));
    setEditing(null);
  };

  if (editing) {
    return (
      <div className="pb-24">
        <Header title={editing === 'new' ? `Add ${noun}` : `Edit ${noun}`} onBack={() => setEditing(null)} />
        <div className="px-4 pt-4 space-y-4">
          {errors.length > 0 && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold p-4 space-y-1">{errors.map(x => <div key={x}>• {x}</div>)}</div>}
          <div className="card space-y-4">
            {fields.map(f => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                {f.type === 'select' ? (
                  <select className="field" value={form[f.key] ?? ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}>
                    <option value="">Select</option>
                    {f.options!.map(o => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    className="field" type={f.type ?? 'text'} value={form[f.key] ?? ''} placeholder={f.type === 'password' && editing !== 'new' ? 'Leave blank to keep current' : f.placeholder}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
            <div>
              <label className="label">Status</label>
              <select className="field" value={form.status ?? 'Active'} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                <option>Active</option><option>Inactive</option>
              </select>
            </div>
          </div>
          <button className="btn" onClick={save}>Save {noun}</button>
        </div>
      </div>
    );
  }

  const groups: FilterGroup[] = filterGroups;
  const list = items.filter(r => matches(q, ...searchKeys.map(k => r[k])) && groups.every(g => !filters[g.key] || r[g.key] === filters[g.key]));
  const active = Object.values(filters).filter(Boolean).length;
  const toggle = (r: Rec) => setItems(p => p.map(x => x.id === r.id ? { ...x, status: x.status === 'Active' ? 'Inactive' : 'Active' } : x));
  return (
    <div className="pb-24">
      <Header title={title} onBack={onBack} />
      <div className="px-4 pt-4 space-y-3">
        <SearchBar value={q} onChange={setQ} placeholder={searchPlaceholder} count={list.length} noun={noun.toLowerCase()} filterCount={active} onFilters={() => setSheet(true)} />
        <FilterChips groups={groups} values={filters} onRemove={k => setFilters(f => ({ ...f, [k]: '' }))} />
        <button className="btn" onClick={() => begin('new')}>Add {noun}</button>
        {list.length === 0 && <NoResults onClear={() => { setQ(''); setFilters({}); }} />}
        {list.map(r => (
          <div key={r.id} className="card">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-bold text-gray-900 truncate">{primary(r)}</div>
                <div className="text-xs text-gray-500 mt-1">{secondary(r)}</div>
              </div>
              <span className={`tag ${r.status === 'Active' ? 'tag-green' : 'tag-red'}`}>{r.status}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button className="btn btn-secondary" onClick={() => begin(r)}>Edit</button>
              <button className={`btn ${r.status === 'Active' ? 'btn-danger' : 'btn-secondary'}`} onClick={() => (r.status === 'Active' ? setConfirm(r) : toggle(r))}>
                {r.status === 'Active' ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>
      <FilterSheet open={sheet} groups={groups} values={filters} onApply={setFilters} onClose={() => setSheet(false)} />
      {confirm && <ConfirmDialog title={`Deactivate ${confirm.name}?`} onCancel={() => setConfirm(null)} onConfirm={() => { toggle(confirm); setConfirm(null); }} />}
    </div>
  );
}
