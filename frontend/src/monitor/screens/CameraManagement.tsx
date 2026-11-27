import { useState } from 'react';
import { Screen } from '../types';
import { CAMERA_SEED, VENUES } from '../data';
import Header from '../components/Header';

interface Cam { id: string; venue: string; position: 'Front' | 'Back' }
const SEED: Cam[] = CAMERA_SEED;

export default function CameraManagement({ navigate }: { navigate: (s: Screen) => void }) {
  const [cams, setCams] = useState<Cam[]>(SEED);
  const [editing, setEditing] = useState<Cam | 'new' | null>(null);
  const [venue, setVenue] = useState('');
  const [position, setPosition] = useState<'Front' | 'Back'>('Front');
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<Cam | null>(null);

  const begin = (c: Cam | 'new') => {
    setEditing(c); setError('');
    setVenue(c === 'new' ? '' : c.venue);
    setPosition(c === 'new' ? 'Front' : c.position);
  };
  const save = () => {
    if (!venue) { setError('Venue is required.'); return; }
    if (cams.some(c => c.venue === venue && (editing === 'new' || c.id !== (editing as Cam).id))) { setError('This venue already has a camera.'); return; }
    if (editing === 'new') setCams(p => [...p, { id: `c${Date.now()}`, venue, position }]);
    else if (editing) setCams(p => p.map(c => c.id === (editing as Cam).id ? { ...c, venue, position } : c));
    setEditing(null);
  };

  if (editing) {
    return (
      <div className="pb-6">
        <Header title={editing === 'new' ? 'Add Camera' : 'Update Camera'} onBack={() => setEditing(null)} />
        <div className="px-4 pt-4 space-y-4">
          {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold p-4">{error}</div>}
          <div className="card space-y-4">
            <div>
              <label className="label">Venue</label>
              <select className="field" value={venue} onChange={e => setVenue(e.target.value)}>
                <option value="">Select venue</option>
                {VENUES.map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Position</label>
              <div className="grid seg grid grid-cols-2">
                {(['Front', 'Back'] as const).map(p => (
                  <button key={p} onClick={() => setPosition(p)} className="seg-btn" style={{ background: position === p ? '#166534' : 'transparent', color: position === p ? '#fff' : '#64748B' }}>{p}</button>
                ))}
              </div>
            </div>
          </div>
          <button className="btn" onClick={save}>{editing === 'new' ? 'Add Camera' : 'Update Camera'}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <Header title="Camera Management" onBack={() => navigate('adminPanel')} />
      <div className="px-4 pt-4 space-y-3">
        <button className="btn" onClick={() => begin('new')}>Add Camera</button>
        {cams.length === 0 && <div className="card text-sm text-gray-500 text-center">No cameras added.</div>}
        {cams.map(c => (
          <div key={c.id} className="card">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-gray-900">{c.venue}</div>
              <span className="tag tag-blue">{c.position}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button className="btn btn-secondary" onClick={() => begin(c)}>Update</button>
              <button className="btn btn-danger" onClick={() => setRemoving(c)}>Remove</button>
            </div>
          </div>
        ))}
      </div>
      {removing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={() => setRemoving(null)}>
          <div className="bg-white rounded-[14px] p-5 w-full max-w-[360px]" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="text-base font-bold text-gray-900">Remove camera?</div>
            <p className="text-sm text-gray-600 mt-2">The {removing.position.toLowerCase()} camera in {removing.venue} will stop capturing attendance.</p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button className="btn btn-secondary" onClick={() => setRemoving(null)}>Cancel</button>
              <button className="btn" style={{ background: '#B91C1C' }} onClick={() => { setCams(p => p.filter(x => x.id !== removing.id)); setRemoving(null); }}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
