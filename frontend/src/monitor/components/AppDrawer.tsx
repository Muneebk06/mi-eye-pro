import { useEffect, useRef, useState } from 'react';
import { Icon, IconName } from './Icons';
import { Screen } from '../types';

export interface DrawerItem { label: string; icon: IconName; screen: Screen; badge?: number; onSelect?: () => void }

interface Props {
  open: boolean;
  pushEnabled: boolean;
  name: string;
  roleLine: string;
  items: DrawerItem[];
  onClose: () => void;
  onNavigate: (screen: Screen) => void;
  onTogglePush: () => void;
  onLogout: () => void;
}

const Item = ({ label, icon, badge, onClick }: { label: string; icon: IconName; badge?: number; onClick: () => void }) => (
  <button onClick={onClick} className="w-full min-h-14 flex items-center gap-3 px-4 text-left active:bg-gray-50">
    <span className="menu-icon"><Icon name={icon} size={20} /></span>
    <span className="flex-1 text-sm font-semibold text-gray-900">{label}</span>
    {!!badge && <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-semibold leading-5 text-center">{badge}</span>}
  </button>
);

export default function AppDrawer({ open, pushEnabled, name, roleLine, items, onClose, onNavigate, onTogglePush, onLogout }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [closing, setClosing] = useState(false);
  const startX = useRef<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const ignorePop = useRef(false);
  const closingRef = useRef(false);
  const confirmRef = useRef(false);

  const finish = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setConfirming(false); setClosing(false); closingRef.current = false;
      if ((window.history.state as { drawer?: boolean } | null)?.drawer) { ignorePop.current = true; window.history.back(); }
      onClose();
    }, 200);
  };
  const dismiss = (after?: () => void) => {
    if (closingRef.current) return;
    closingRef.current = true; setClosing(true); after?.(); finish();
  };

  useEffect(() => {
    if (!open) return;
    window.history.pushState({ drawer: true }, '');
    const onPop = () => { if (ignorePop.current) { ignorePop.current = false; return; } if (!closingRef.current) { closingRef.current = true; setClosing(true); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => { setConfirming(false); setClosing(false); closingRef.current = false; onClose(); }, 200); } };
    const onKey = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; e.preventDefault(); if (confirmRef.current) setConfirming(false); else dismiss(); };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; window.clearTimeout(timer.current); };
  }, [open]);
  useEffect(() => { confirmRef.current = confirming; }, [confirming]);

  if (!open) return null;
  const go = (screen: Screen) => dismiss(() => onNavigate(screen));
  const close = () => dismiss();

  return (
    <div className="fixed inset-0 z-[60] flex justify-center" role="dialog" aria-modal="true" aria-label="Menu">
      <button className={`absolute inset-0 bg-gray-900/50 ${closing ? 'backdrop-out' : 'backdrop-in'}`} onClick={close} aria-label="Close menu" />
      <div className="drawer-frame relative w-full max-w-[430px] overflow-hidden pointer-events-none">
        <aside
          className={`${closing ? 'drawer-out' : 'drawer-in'} pointer-events-auto absolute left-0 top-0 min-h-screen w-[80%] flex flex-col bg-white shadow-xl`}
          onTouchStart={e => { startX.current = e.touches[0].clientX; }}
          onTouchEnd={e => { if (startX.current !== null && e.changedTouches[0].clientX - startX.current < -50) close(); startX.current = null; }}
        >
          <div className="px-4 pb-5 text-white bg-primary flex items-center gap-3" style={{ paddingTop: 'max(env(safe-area-inset-top), 54px)' }}>
            <div className="w-14 h-14 rounded-full bg-white text-primary text-2xl font-bold flex items-center justify-center flex-shrink-0" aria-hidden>{name.replace(/^(Mr|Ms|Mrs|Dr|Prof)\.?\s+/, '').charAt(0)}</div>
            <div className="min-w-0">
              <div className="text-base font-bold leading-tight">{name}</div>
              <div className="text-xs text-white/90 mt-1 leading-snug">{roleLine}</div>
            </div>
            <button onClick={close} aria-label="Close menu" className="ml-auto self-start -mr-2 -mt-1 w-11 h-11 flex items-center justify-center rounded-full text-white active:bg-white/15 flex-shrink-0"><Icon name="close" size={22} /></button>
          </div>
          <div className="py-1">
            {items.map(it => <Item key={it.label} label={it.label} icon={it.icon} badge={it.badge} onClick={() => { if (it.onSelect) dismiss(it.onSelect); else go(it.screen); }} />)}
          </div>
          <div className="border-t border-gray-100 py-1">
            <button onClick={onTogglePush} className="w-full min-h-14 flex items-center gap-3 px-4 text-left active:bg-gray-50">
              <span className="menu-icon"><Icon name="bell" size={20} /></span>
              <span className="flex-1 text-sm font-semibold text-gray-900">Push Notifications</span>
              <span className={`w-11 h-6 rounded-full p-0.5 flex ${pushEnabled ? 'justify-end bg-primary' : 'justify-start bg-gray-300'}`} role="switch" aria-checked={pushEnabled}>
                <span className="w-5 h-5 rounded-full bg-white shadow" />
              </span>
            </button>
            <button onClick={() => setConfirming(true)} className="w-full min-h-14 flex items-center gap-3 px-4 text-left active:bg-gray-50">
              <span className="menu-icon !bg-red-50 !text-red-700"><Icon name="logout" size={20} /></span>
              <span className="text-sm font-semibold text-red-700">Logout</span>
            </button>
          </div>
          <p className="px-4 py-4 text-center text-[11px] text-gray-400">BIIT AI Classroom Monitor · v1.0.2</p>
        </aside>
        {confirming && (
          <div className="pointer-events-auto absolute inset-0 z-10 flex items-center justify-center px-6 bg-gray-900/40" role="alertdialog" aria-label="Log out?">
            <div className="card w-full">
              <h3 className="title-card">Log out?</h3>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button className="btn btn-secondary" onClick={() => setConfirming(false)}>Cancel</button>
                <button className="btn btn-danger" onClick={() => { dismiss(onLogout); }}>Log out</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
