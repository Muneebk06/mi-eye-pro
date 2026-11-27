import { ReactNode } from 'react';
import { Screen } from '../types';
import { Icon } from './Icons';
import { useRemarks } from '../RemarkContext';
const logo = '/biit.png';

interface HeaderProps {
  title: string;
  onBack?: () => void;
  onNotifications?: () => void;
  onMenu?: () => void;
  navigate?: (screen: Screen) => void;
  showMenu?: boolean;
  rightAction?: ReactNode;
  hero?: ReactNode;
}

const iconBtn = 'w-11 h-11 flex items-center justify-center text-white active:opacity-60 relative';

export default function Header({ title, onBack, onNotifications, onMenu, showMenu, rightAction, hero }: HeaderProps) {
  const { bell } = useRemarks();
  return (
    <header
      className={`no-print z-20 text-white ${hero ? '' : 'sticky top-0'}`}
      style={{ background: '#166534', paddingTop: 'max(env(safe-area-inset-top), 54px)', borderRadius: hero ? '0 0 24px 24px' : undefined }}
    >
      <div className="flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-3 min-w-0">
          {onBack ? (
            <button onClick={onBack} aria-label="Back" className={`${iconBtn} -ml-3`}><Icon name="back" /></button>
          ) : onMenu ? (
            <>
              <button onClick={onMenu} aria-label="Open menu" className={`${iconBtn} -ml-3 -mr-1`}><Icon name="menu" /></button>
              {showMenu && <img src={logo} alt="BIIT" className="w-9 h-9 rounded-full bg-white object-cover" />}
            </>
          ) : showMenu ? (
            <img src={logo} alt="BIIT" className="w-9 h-9 rounded-full bg-white object-cover" />
          ) : null}
          <h1 className={hero ? 'sr-only' : 'title-page truncate'}>{title}</h1>
        </div>
        <div className="flex items-center">
          {rightAction}
          {onNotifications && (
            <button onClick={onNotifications} aria-label="Notifications" className={`${iconBtn} -mr-2`}>
              <Icon name="bell" />
              {bell > 0
                ? <span className="absolute top-1.5 right-1 min-w-4 h-4 px-1 bg-red-500 rounded-full text-[11px] font-semibold leading-4 text-center ring-2 ring-[#166534]">{bell}</span>
                : <span className="absolute top-2.5 right-3 w-2 h-2 bg-red-500 rounded-full ring-2 ring-[#166534]" />}
            </button>
          )}
        </div>
      </div>
      {hero && <div className="px-4 pt-1 pb-12 min-[860px]:pb-6">{hero}</div>}
    </header>
  );
}
