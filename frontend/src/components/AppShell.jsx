'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ROLE_NAV } from '@/lib/nav';

export default function AppShell({ role, userName, userSubtitle, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const items = ROLE_NAV[role];
  const rootHref = `/${role}`;

  const isActive = (href) =>
    href === rootHref ? pathname === href : pathname.startsWith(href);

  const handleLogout = () => {
    router.replace('/login');
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-700 font-bold text-white">
            M
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">MEye-Pro</p>
            <p className="text-xs capitalize text-slate-500">{role} Portal</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3.5 py-2.5 text-sm font-medium transition ${
                isActive(item.href)
                  ? 'bg-green-50 text-green-800'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900">{userName}</p>
          <p className="text-xs text-slate-500">{userSubtitle}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 w-full rounded-lg border border-slate-300 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col">
        {/* Mobile Top Bar */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <div>
            <p className="text-sm font-bold text-green-800">MEye-Pro</p>
            <p className="text-xs text-slate-500">{userName}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600"
          >
            Sign Out
          </button>
        </header>

        <main className="flex-1 p-4 pb-20 md:p-8 md:pb-8">{children}</main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-200 bg-white md:hidden">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 py-3 text-center text-xs font-medium ${
              isActive(item.href)
                ? 'border-t-2 border-green-700 text-green-800'
                : 'text-slate-500'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
