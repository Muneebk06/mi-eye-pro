import { Icon, IconName } from './Icons';

export interface MenuItem { title: string; sub: string; icon: IconName; onClick: () => void; badge?: number }

export default function MenuList({ items }: { items: MenuItem[] }) {
  return (
    <div className="card !p-0 overflow-hidden">
      {items.map((it, i) => (
        <div key={it.title}>
          {i > 0 && <div className="h-px bg-gray-200 ml-[68px]" />}
          <button onClick={it.onClick} className="w-full min-h-[64px] px-4 py-3 flex items-center gap-3 text-left active:bg-gray-50">
            <span className="menu-icon"><Icon name={it.icon} size={20} /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-semibold text-gray-900">{it.title}</span>
              <span className="block text-[13px] text-gray-500 mt-0.5">{it.sub}</span>
            </span>
            {it.badge ? <span className="tag tag-amber">{it.badge}</span> : null}
            <Icon name="chevron" size={20} className="text-gray-500 flex-shrink-0" />
          </button>
        </div>
      ))}
    </div>
  );
}
