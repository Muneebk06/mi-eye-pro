import { useState } from 'react';
import { Icon } from './Icons';

const store = new Map<string, unknown>();
/** useState whose value survives unmounting (e.g. opening a detail screen and coming back). */
export function useSticky<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [v, set] = useState<T>(() => (store.has(key) ? (store.get(key) as T) : initial));
  const setter = (n: T | ((p: T) => T)) => set(prev => { const next = typeof n === 'function' ? (n as (p: T) => T)(prev) : n; store.set(key, next); return next; });
  return [v, setter];
}

export const matches = (q: string, ...fields: (string | undefined)[]) => {
  const t = q.trim().toLowerCase();
  return !t || fields.some(f => (f ?? '').toLowerCase().includes(t));
};

export interface FilterGroup { key: string; label: string; options: string[]; allLabel?: string }
export interface FilterToggle { key: string; label: string }
export type FilterValues = Record<string, string>;

interface SearchBarProps { value: string; onChange: (v: string) => void; placeholder: string; count: number; noun?: string; summary?: string; filterCount?: number; onFilters?: () => void }

export function SearchBar({ value, onChange, placeholder, count, noun, summary, filterCount = 0, onFilters }: SearchBarProps) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"><Icon name="search" size={18} /></span>
          <input className="field !pl-10 !pr-11" type="text" inputMode="search" value={value} placeholder={placeholder} aria-label={placeholder} onChange={e => onChange(e.target.value)} />
          {value && <button onClick={() => onChange('')} aria-label="Clear search" className="absolute right-0 top-0 w-11 h-full flex items-center justify-center text-gray-500 active:opacity-60"><Icon name="close" size={18} /></button>}
        </div>
        {onFilters && (
          <button onClick={onFilters} className="relative flex-shrink-0 h-[46px] min-w-11 px-3 rounded-[10px] border border-gray-300 bg-white flex items-center gap-1.5 text-sm font-semibold text-gray-700 active:bg-gray-100" aria-label="Filters">
            <Icon name="filter" size={18} />Filters
            {filterCount > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-primary text-white text-[11px] font-semibold leading-5 text-center">{filterCount}</span>}
          </button>
        )}
      </div>
      <div className="text-xs text-gray-500 mt-2" aria-live="polite">{summary ?? `${count} ${count === 1 ? (noun ?? 'result') : (noun ? `${noun}s` : 'results')}`}</div>
    </div>
  );
}

export function FilterChips({ groups, values, onRemove }: { groups: FilterGroup[]; values: FilterValues; onRemove: (key: string) => void }) {
  const active = groups.filter(g => values[g.key]);
  if (!active.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {active.map(g => (
        <button key={g.key} onClick={() => onRemove(g.key)} className="tag tag-green !min-h-8 active:opacity-70" aria-label={`Remove ${g.label} filter`}>
          {g.label}: {values[g.key]}<Icon name="close" size={14} />
        </button>
      ))}
    </div>
  );
}

export function FilterSheet({ open, title = 'Filters', groups, toggles, values, onApply, onClose }: { open: boolean; title?: string; groups: FilterGroup[]; toggles?: FilterToggle[]; values: FilterValues; onApply: (v: FilterValues) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<FilterValues>(values);
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) { setWasOpen(true); setDraft(values); }
  if (!open && wasOpen) setWasOpen(false);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-center items-end" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-gray-900/50" onClick={onClose} aria-label="Close filters" />
      <div className="sheet-in relative w-full max-w-[430px] bg-white rounded-t-[20px] p-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="title-section">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="w-11 h-11 -mr-3 flex items-center justify-center text-gray-500"><Icon name="close" size={20} /></button>
        </div>
        <div className="space-y-4">
          {groups.map(g => (
            <div key={g.key}>
              <label className="label" htmlFor={`f-${g.key}`}>{g.label}</label>
              <select id={`f-${g.key}`} className="field" value={draft[g.key] ?? ''} onChange={e => setDraft(d => ({ ...d, [g.key]: e.target.value }))}>
                <option value="">{g.allLabel ?? 'All'}</option>
                {g.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
          {toggles?.map(t => {
            const on = !!draft[t.key];
            return (
              <button key={t.key} onClick={() => setDraft(d => ({ ...d, [t.key]: on ? '' : 'on' }))} className="w-full min-h-11 flex items-center gap-3 text-left" role="switch" aria-checked={on}>
                <span className="flex-1 text-sm font-semibold text-gray-900">{t.label}</span>
                <span className={`w-11 h-6 rounded-full p-0.5 flex ${on ? 'justify-end bg-primary' : 'justify-start bg-gray-300'}`}><span className="w-5 h-5 rounded-full bg-white shadow" /></span>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-3 mt-6">
          <button className="btn btn-secondary" onClick={() => setDraft({})}>Reset</button>
          <button className="btn" onClick={() => { onApply(draft); onClose(); }}>Apply</button>
        </div>
      </div>
    </div>
  );
}

export function NoResults({ onClear, text = 'No results found' }: { onClear?: () => void; text?: string }) {
  return (
    <div className="card text-center">
      <div className="text-sm font-semibold text-gray-900">{text}</div>
      {onClear && <button onClick={onClear} className="text-sm font-semibold mt-2 min-h-11 px-3" style={{ color: '#166534' }}>Clear filters</button>}
    </div>
  );
}
