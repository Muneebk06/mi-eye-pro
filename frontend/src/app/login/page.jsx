'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { detectRole } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!identifier.trim() || !password.trim()) {
      setError('Email/ARID No aur password dono required hain.');
      return;
    }

    setError('');
    const role = detectRole(identifier);
    router.replace(`/${role}`);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-green-700 text-lg font-bold text-white">
            M
          </div>
          <h1 className="text-2xl font-bold text-slate-900">MEye-Pro</h1>
          <p className="mt-1 text-sm text-slate-500">
            BIIT AI Classroom Monitoring System
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Email or ARID No.
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. 22-arid-1234 or ahmed@biit.edu.pk"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 pr-16 text-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-green-700 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800"
          >
            Sign In
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          Role is detected automatically from your ID or email.
        </p>
      </div>
    </main>
  );
}
