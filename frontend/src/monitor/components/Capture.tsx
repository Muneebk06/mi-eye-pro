import { useState } from 'react';
import { detectedCaptures } from '../data';

function heads(seed: string) {
  let h = 7;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) % 9973;
  return Array.from({ length: 10 }, (_, i) => ({
    x: 10 + ((i % 5) * 20) + ((h + i * 7) % 6),
    y: 38 + Math.floor(i / 5) * 24 + ((h + i * 3) % 5),
  }));
}

export function CaptureTile({ seed, label, highlight, onClick, square }: { seed: string; label: string; highlight?: boolean; onClick?: () => void; square?: boolean }) {
  const hs = heads(seed);
  const hl = hs[(seed.length * 3) % hs.length];
  return (
    <button onClick={onClick} className={`relative block w-full ${square ? 'aspect-square rounded-[10px]' : 'aspect-[4/3] rounded-lg'} overflow-hidden bg-slate-200 active:opacity-80`}>
      <svg viewBox="0 0 100 75" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
        <rect width="100" height="75" fill="#CBD5E1" />
        <rect x="25" y="4" width="50" height="14" rx="1" fill="#94A3B8" />
        {hs.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4.5" fill="#64748B" />
            <rect x={p.x - 6} y={p.y + 5} width="12" height="8" rx="3" fill="#475569" />
          </g>
        ))}
        {highlight && <rect x={hl.x - 7} y={hl.y - 7} width="14" height="14" fill="none" stroke="#166534" strokeWidth="1.5" rx="1" />}
      </svg>
      <span className={`absolute text-[12px] font-medium text-white bg-slate-900/75 text-left leading-tight ${square ? 'bottom-1 left-1 rounded px-1.5 py-0.5' : 'bottom-0 inset-x-0 px-2 py-1'}`}>{label}</span>
    </button>
  );
}

export function CapturePreview({ seed, label, onClose }: { seed: string; label: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-[400px]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-end mb-2">
          <button onClick={onClose} aria-label="Close" className="w-11 h-11 rounded-full bg-white text-slate-900 flex items-center justify-center active:opacity-70">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="rounded-[14px] overflow-hidden"><CaptureTile seed={seed} label={label} highlight /></div>
        <button onClick={onClose} className="btn btn-secondary mt-4">Close</button>
      </div>
    </div>
  );
}

export function CaptureGrid({ seed, indexes, time, label, cols = 4, square }: { seed: string; indexes: number[]; time: (i: number) => string; label?: string; cols?: number; square?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {indexes.map(i => (
          <CaptureTile key={i} seed={`${seed}-${i}`} label={square ? time(i) : `#${i + 1} · ${time(i)}`} square={square} highlight={!!label} onClick={() => setOpen(i)} />
        ))}
      </div>
      {open !== null && <CapturePreview seed={`${seed}-${open}`} label={`Capture #${open + 1} · ${time(open)}`} onClose={() => setOpen(null)} />}
    </>
  );
}

export const detectedIdx = detectedCaptures;
