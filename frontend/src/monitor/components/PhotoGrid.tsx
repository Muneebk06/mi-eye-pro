import { useRef } from 'react';
import { Icon } from './Icons';

/** Neutral generated avatar (SVG data URL) with initials. */
export const avatarUrl = (name: string, hue = 150) => {
  const ini = name.replace(/^(Mr|Dr|Prof|Ms|Mrs)\.?\s+/i, '').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="hsl(${hue},25%,88%)"/><circle cx="120" cy="96" r="42" fill="hsl(${hue},25%,70%)"/><path d="M40 240c0-50 36-80 80-80s80 30 80 80z" fill="hsl(${hue},25%,70%)"/><text x="120" y="224" font-family="Inter,Arial" font-size="28" font-weight="700" text-anchor="middle" fill="hsl(${hue},40%,25%)">${ini}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

interface Props { value: (string | null)[]; onChange: (v: (string | null)[]) => void; columns?: number }

export default function PhotoGrid({ value, onChange, columns = 2 }: Props) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const set = (i: number, url: string | null) => onChange(value.map((x, j) => (j === i ? url : x)));
  const pick = (i: number, f?: File) => { if (f) set(i, URL.createObjectURL(f)); };
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {value.map((p, i) => (
        <div key={i}>
          <input ref={el => { inputs.current[i] = el; }} type="file" accept="image/*" className="hidden" onChange={e => { pick(i, e.target.files?.[0]); e.target.value = ''; }} />
          {p ? (
            <div>
              <img src={p} alt={`Photo ${i + 1}`} className="w-full aspect-square rounded-xl object-cover border border-gray-200" />
              <div className="text-xs font-semibold text-gray-600 mt-1">Photo {i + 1}</div>
              <div className="grid grid-cols-2 gap-1 mt-1">
                <button type="button" onClick={() => inputs.current[i]?.click()} className="min-h-11 text-sm font-semibold rounded-lg border border-gray-300 bg-white text-gray-700 active:bg-gray-100">Replace</button>
                <button type="button" onClick={() => set(i, null)} className="min-h-11 text-sm font-semibold rounded-lg border border-red-200 bg-red-50 text-red-700 active:opacity-70">Remove</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => inputs.current[i]?.click()} aria-label={`Add photo ${i + 1}`} className="w-full aspect-square rounded-xl border border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center gap-1 text-primary active:opacity-70" style={{ color: '#166534' }}>
              <Icon name="camera" size={28} />
              <span className="text-sm font-semibold text-gray-700">Photo {i + 1}</span>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
