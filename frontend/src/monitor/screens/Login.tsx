import { useState } from 'react';
import { Role } from '../types';
import { ARID_RE } from '../data';
const logo = '/biit.png';

export function detectRole(id: string): Role {
  const v = id.trim().toLowerCase();
  if (ARID_RE.test(v) || v.includes('student')) return 'student';
  if (v.includes('director')) return 'director';
  if (v.includes('admin')) return 'admin';
  return 'teacher';
}
const ROLE_LABEL: Record<Role, string> = { teacher: 'Teacher', student: 'Student', admin: 'Admin', director: 'Director' };

export default function Login({ onLogin }: { onLogin: (role: Role) => void }) {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const ready = id.trim() && password;

  return (
    <div className="login-layout min-h-screen flex flex-col bg-[#F8FAFC]">
      <div className="flex flex-col items-center justify-end pb-8 px-6" style={{ background: '#166534', borderRadius: '0 0 24px 24px', paddingTop: 'calc(env(safe-area-inset-top) + 40px)' }}>
        <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center mb-4" style={{ boxShadow: '0 4px 16px rgba(0,0,0,.18)' }}>
          <img src={logo} alt="BIIT" className="w-20 h-20 rounded-full object-cover" />
        </div>
        <h1 className="text-white text-[22px] font-bold text-center">BIIT AI Classroom Monitor</h1>
        <p className="text-white/80 text-xs font-medium mt-1 text-center">Barani Institute of Information Technology</p>
      </div>

      <form onSubmit={e => { e.preventDefault(); if (ready) onLogin(detectRole(id)); }} className="flex-1 px-4 pt-6 pb-8 space-y-4">
        <div>
          <h2 className="title-section !text-xl !font-bold">Sign in</h2>
          <p className="text-gray-500 text-sm mt-1">Your role is detected automatically.</p>
        </div>

        <div>
          <label htmlFor="identifier" className="label">Email or Arid No.</label>
          <input id="identifier" autoComplete="username" value={id} onChange={e => setId(e.target.value)} placeholder="name@biit.edu.pk or 2023-ARID-3855" className="field" autoCapitalize="none" />
          {id.trim() && <span className="tag tag-green mt-2">Signing in as {ROLE_LABEL[detectRole(id)]}</span>}
        </div>

        <div>
          <label htmlFor="password" className="label">Password</label>
          <div className="relative">
            <input id="password" autoComplete="current-password" type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="field pr-16" />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-0 top-0 h-12 px-4 text-xs font-semibold text-gray-500 active:opacity-60">{show ? 'Hide' : 'Show'}</button>
          </div>
        </div>

        <button type="submit" disabled={!ready} className="btn">Sign In</button>
      </form>
    </div>
  );
}
