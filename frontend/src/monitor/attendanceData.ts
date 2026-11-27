import { ReportRow, SHORTAGE, SECTION_COURSES, StudentRecord, TODAY, addDays, reportRows, rng } from './data';

export interface Att { id: string; iso: string; start: number; code: string; venue: string; detected: number; present: boolean }

export const RANGES = ['Last 7 days', 'Last 30 days'] as const;
export const rangeStart = (range?: string) => (range === 'Last 7 days' ? addDays(TODAY, -7) : range === 'Last 30 days' ? addDays(TODAY, -30) : '');

let held: ReportRow[] | null = null;
const heldRows = () => (held ??= reportRows([], 60).filter(r => r.status !== 'Not Held'));
const cache = new Map<string, Att[]>();

/** Deterministic lecture-by-lecture attendance for one student, newest first. */
export function attendanceOf(s: StudentRecord): Att[] {
  const hit = cache.get(s.arid);
  if (hit) return hit;
  const r0 = rng(s.arid)();
  const bias = r0 < 0.08 ? 0.62 + r0 * 2 : 0.85 + r0 * 0.13;
  const out: Att[] = [];
  for (const code of SECTION_COURSES[s.section]) {
    const rows = heldRows().filter(r => r.section === s.section && r.code === code);
    if (!rows.length) continue;
    const sh = SHORTAGE.find(x => x.arid === s.arid && x.code === code);
    const absent = new Set<string>();
    if (sh) {
      const k = Math.round(rows.length * (1 - sh.attended / sh.total));
      [...rows].sort((a, b) => rng(a.id + s.arid + 'x')() - rng(b.id + s.arid + 'x')()).slice(0, k).forEach(r => absent.add(r.id));
    }
    for (const r of rows) {
      const present = sh ? !absent.has(r.id) : rng(r.id + s.arid)() < bias;
      const w = rng(r.id + s.arid + 'd')();
      out.push({ id: r.id, iso: r.iso, start: r.sched, code, venue: r.venue, detected: present ? 8 + Math.floor(w * 3) : Math.floor(w * 8), present });
    }
  }
  out.sort((a, b) => (a.iso === b.iso ? b.start - a.start : a.iso < b.iso ? 1 : -1));
  cache.set(s.arid, out);
  return out;
}

export function summarize(list: Att[], course?: string, range?: string) {
  const from = rangeStart(range);
  const l = list.filter(a => (!course || a.code === course) && (!from || a.iso >= from));
  const attended = l.filter(a => a.present).length;
  return { attended, total: l.length, pct: l.length ? Math.round((attended / l.length) * 100) : 0 };
}

export const attScroll = { y: 0, restore: false };
