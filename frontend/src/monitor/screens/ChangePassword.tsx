import { useState } from 'react';
import Header from '../components/Header';
import { Icon } from '../components/Icons';

function PasswordField({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <input className="field pr-12" type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} aria-invalid={!!error} autoComplete="off" />
        <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-0 top-0 w-12 h-12 flex items-center justify-center text-gray-500 active:opacity-60">
          <Icon name={show ? 'eyeOff' : 'eye'} size={20} />
        </button>
      </div>
      {error && <p className="text-xs font-semibold text-red-700 mt-1">{error}</p>}
    </div>
  );
}

export default function ChangePassword({ onBack }: { onBack: () => void }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [conf, setConf] = useState('');
  const [done, setDone] = useState(false);
  const errs = {
    cur: cur ? '' : 'Enter your current password.',
    next: next.length >= 8 ? '' : 'Use at least 8 characters.',
    conf: conf === next && conf ? '' : 'Passwords do not match.',
  };
  const valid = !errs.cur && !errs.next && !errs.conf;
  const show = (v: string, e: string) => (v ? e : '');
  const save = () => { if (!valid) return; setDone(true); setTimeout(onBack, 1400); };

  return (
    <div>
      <Header title="Change Password" onBack={onBack} />
      <div className="px-4 pt-4 pb-24 space-y-4">
        <div className="card space-y-4">
          <PasswordField label="Current password" value={cur} onChange={setCur} />
          <PasswordField label="New password" value={next} onChange={setNext} error={show(next, errs.next)} />
          <PasswordField label="Confirm new password" value={conf} onChange={setConf} error={show(conf, errs.conf)} />
        </div>
        {done && <div className="card flex items-center gap-2 text-sm font-semibold text-green-800" role="status"><Icon name="check" size={18} />Password changed successfully.</div>}
        <button className="btn" disabled={!valid || done} onClick={save}>Save Password</button>
      </div>
    </div>
  );
}
