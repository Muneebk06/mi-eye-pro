import { Role } from './types';

export const PRESENT_THRESHOLD = 8;
export const TOTAL_CAPTURES = 10;
export const MIN_ATTENDANCE = 75;
export const TEACHER = 'Mr. Umar Farooq';
export const STUDENT = { name: 'Ali Khan', arid: '2023-ARID-3855', section: 'BSCS-5A' };

export const ARID_RE = /^\d{4}-ARID-\d{4}$/i;
export const VENUE_RE = /^(Lt\d+|Lab\d+|Online)$/i;
export const VENUES = ['Lt1', 'Lt2', 'Lt3', 'Lab1', 'Lab2', 'Lab3', 'Lab4', 'Lab5'];
export const CAMERA_SEED: { id: string; venue: string; position: 'Front' | 'Back' }[] = [
  { id: 'c1', venue: 'Lt1', position: 'Front' },
  { id: 'c2', venue: 'Lt2', position: 'Back' },
  { id: 'c3', venue: 'Lab3', position: 'Front' },
  { id: 'c4', venue: 'Lab5', position: 'Back' },
];
export const CAMERA_VENUES = CAMERA_SEED.map(c => c.venue);

export const COURSES = [
  { code: 'CS-501', short: 'SE', name: 'Software Engineering', teacher: TEACHER, venue: 'Lab3' },
  { code: 'CS-502', short: 'DS', name: 'Data Structures', teacher: 'Dr. Sara Malik', venue: 'Lt1' },
  { code: 'CS-503', short: 'CN', name: 'Computer Networks', teacher: 'Prof. Ali Hassan', venue: 'Lab5' },
  { code: 'CS-504', short: 'OS', name: 'Operating Systems', teacher: 'Dr. Maria Qureshi', venue: 'Lt2' },
  { code: 'CS-505', short: 'AI', name: 'Artificial Intelligence', teacher: TEACHER, venue: 'Lab3' },
  { code: 'HU-101', short: 'PS', name: 'Pakistan Studies', teacher: 'Mr. Khalid Mehmood', venue: 'Online' },
];
export const courseByCode = (code: string) => COURSES.find(c => c.code === code)!;
export const isOwn = (code: string) => courseByCode(code).teacher === TEACHER;

export const SECTION_COURSES: Record<string, string[]> = {
  'BSCS-5A': ['CS-501', 'CS-502', 'CS-503', 'CS-504', 'CS-505', 'HU-101'],
  'BSCS-5B': ['CS-501', 'CS-502', 'CS-503', 'CS-504', 'CS-505', 'HU-101'],
  'BSSE-3A': ['CS-501', 'CS-502', 'CS-503', 'HU-101'],
};
export const SECTIONS = Object.keys(SECTION_COURSES);
export const SECTION_SIZE: Record<string, number> = { 'BSCS-5A': 35, 'BSCS-5B': 32, 'BSSE-3A': 30 };
const SECTION_BASE: Record<string, number> = { 'BSCS-5A': 3855, 'BSCS-5B': 3955, 'BSSE-3A': 4055 };
const SECTION_YEAR: Record<string, number> = { 'BSCS-5A': 2023, 'BSCS-5B': 2023, 'BSSE-3A': 2024 };
const SECTION_LAST: Record<string, number> = { 'BSCS-5A': 0, 'BSCS-5B': 5, 'BSSE-3A': 10 };
export const SESSIONS = ['Fall 2023', 'Fall 2024', 'Fall 2025'];
export const DISCIPLINES = ['BSCS', 'BSSE', 'BSAI'];
export const sectionsFor = (role: Role) =>
  role === 'teacher' ? SECTIONS.filter(s => SECTION_COURSES[s].some(isOwn)) : SECTIONS;
export const coursesFor = (role: Role, section: string) =>
  (section === 'all' ? COURSES.map(c => c.code) : SECTION_COURSES[section]).filter(c => courseByCode(c).venue !== 'Online' && (role !== 'teacher' || isOwn(c)));

const FIRST = ['Ali', 'Sara', 'Usman', 'Ayesha', 'Bilal', 'Fatima', 'Omar'];
const LAST = ['Khan', 'Ahmed', 'Malik', 'Raza', 'Shah', 'Hussain', 'Iqbal', 'Siddiqui', 'Butt', 'Chaudhry', 'Qureshi', 'Mirza', 'Baig', 'Javed', 'Rehman'];
export interface Student { name: string; arid: string }
export const roster = (section: string): Student[] =>
  Array.from({ length: SECTION_SIZE[section] }, (_, i) => ({
    name: `${FIRST[i % 7]} ${LAST[SECTION_LAST[section] + Math.floor(i / 7)]}`,
    arid: `${SECTION_YEAR[section]}-ARID-${SECTION_BASE[section] + i}`,
  }));
export const rosterAt = (section: string, i: number): Student => roster(section)[i];
export interface StudentRecord extends Student { section: string; discipline: string; session: string; status: 'Active' | 'Inactive' }
export const STUDENT_RECORDS: StudentRecord[] = SECTIONS.flatMap(section =>
  roster(section).map(s => ({ ...s, section, discipline: section.slice(0, 4), session: section === 'BSSE-3A' ? 'Fall 2024' : 'Fall 2023', status: 'Active' as const })));
export const studentByArid = (arid: string) => STUDENT_RECORDS.find(s => s.arid === arid);

export const TEACHER_EMP = 'EMP-1001';
export const DEPARTMENTS = ['Computer Science', 'Software Engineering', 'Artificial Intelligence'];
export interface TeacherRecord { id: string; name: string; empNo: string; email: string; department: string; courses: string[]; status: 'Active' | 'Inactive' }
export const TEACHER_RECORDS: TeacherRecord[] = [
  { id: 't1', name: 'Mr. Umar Farooq', empNo: TEACHER_EMP, email: 'umar.farooq@biit.edu.pk', department: 'Computer Science', courses: ['CS-501', 'CS-505'], status: 'Active' },
  { id: 't2', name: 'Dr. Sara Malik', empNo: 'EMP-1002', email: 'sara.malik@biit.edu.pk', department: 'Computer Science', courses: ['CS-502'], status: 'Active' },
  { id: 't3', name: 'Prof. Ali Hassan', empNo: 'EMP-1003', email: 'ali.hassan@biit.edu.pk', department: 'Software Engineering', courses: ['CS-503'], status: 'Active' },
  { id: 't4', name: 'Dr. Maria Qureshi', empNo: 'EMP-1004', email: 'maria.qureshi@biit.edu.pk', department: 'Computer Science', courses: ['CS-504'], status: 'Inactive' },
  { id: 't5', name: 'Mr. Khalid Mehmood', empNo: 'EMP-1005', email: 'khalid.mehmood@biit.edu.pk', department: 'Computer Science', courses: ['HU-101'], status: 'Active' },
];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function detectedCaptures(seed: string, count: number): number[] {
  const idx = Array.from({ length: TOTAL_CAPTURES }, (_, i) => i);
  const r = rng(seed);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx.slice(0, count).sort((a, b) => a - b);
}
export function detectedCount(sessionId: string, arid: string): number {
  const r = rng(sessionId + arid)();
  return r < 0.78 ? 8 + Math.floor((r / 0.78) * 3) : Math.floor(((r - 0.78) / 0.22) * 8);
}

export const fmtTime = (min: number) => {
  const h = Math.floor(min / 60), m = min % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
export const fmtDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export const captureTime = (time: string, i: number) => {
  const [hm, ap] = time.split(' ');
  const [h, m] = hm.split(':').map(Number);
  return fmtTime(((h % 12) + (ap === 'PM' ? 12 : 0)) * 60 + m + i * 5);
};

/* ---------- Dates ---------- */
const pad = (n: number) => String(n).padStart(2, '0');
export const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MOCK_NOW = { iso: '2026-10-16', min: 10 * 60 + 15 };
export const TODAY = MOCK_NOW.iso;
export const dayOf = (iso: string) => DOW[new Date(iso + 'T00:00:00').getDay()];
export const isWeekday = (iso: string) => !['Sat', 'Sun'].includes(dayOf(iso));
export const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return toIso(d); };
export const prevWeekday = (iso: string) => { let d = addDays(iso, -1); while (!isWeekday(d)) d = addDays(d, -1); return d; };
export const nextWeekday = (iso: string) => { let d = addDays(iso, 1); while (!isWeekday(d)) d = addDays(d, 1); return d; };
export const LAST_WORKDAY = isWeekday(TODAY) ? TODAY : prevWeekday(TODAY);
export const nowMinutes = () => MOCK_NOW.min;
export const hasStarted = (iso: string, start: number) => iso < TODAY || (iso === TODAY && start <= nowMinutes());
export const hasEnded = (iso: string, end: number) => iso < TODAY || (iso === TODAY && end <= nowMinutes());
export const fmtDash = (iso: string) => {
  const d = new Date(iso + 'T00:00:00');
  return `${pad(d.getDate())}-${d.toLocaleDateString('en-GB', { month: 'short' })}-${d.getFullYear()}`;
};
export const fmtShortDay = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/* ---------- Weekly timetable (recurring, 1-hour slots) ---------- */
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
export const DAY_FULL: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday' };
export const SLOT_STARTS = [510, 570, 630, 690, 750, 840, 900, 960, 1020, 1080, 1140, 1200];
const clock = (min: number) => `${Math.floor(min / 60) % 12 || 12}:${pad(min % 60)}`;
export const slotLabel = (start: number) => (start === SLOT_STARTS[0] ? '8:30 AM - 9:30 AM' : `${clock(start)} - ${clock(start + 60)}`);
const PATTERN: Record<string, { days: string[]; slot: number }> = {
  'CS-501': { days: DAYS, slot: 0 },
  'CS-504': { days: ['Mon', 'Thu'], slot: 1 },
  'CS-502': { days: ['Tue', 'Wed', 'Fri'], slot: 2 },
  'CS-505': { days: DAYS, slot: 3 },
  'HU-101': { days: ['Tue', 'Thu'], slot: 4 },
  'CS-503': { days: ['Mon', 'Wed'], slot: 5 },
};
export interface Slot { day: string; start: number; end: number; code: string; section: string; venue: string }
export const SLOTS: Slot[] = SECTIONS.flatMap((section, k) =>
  SECTION_COURSES[section].flatMap(code =>
    PATTERN[code].days.map(day => {
      const start = SLOT_STARTS[PATTERN[code].slot + k];
      return { day, code, section, venue: courseByCode(code).venue, start, end: start + 60 };
    })
  )
);

/* ---------- Date-specific schedule with accepted swaps ---------- */
export interface Occ {
  id: string; iso: string; section: string; code: string; teacher: string; venue: string;
  start: number; end: number; online: boolean; swapped?: boolean; swappedWith?: string; remark?: string;
}
export interface SwapSide { section: string; code: string }
export interface Swap {
  id: string; kind: 'venue' | 'time' | 'reschedule'; iso: string; from: SwapSide; to?: SwapSide; venue?: string; fromVenue?: string;
  sourceIso?: string; start?: number; end?: number;
  fromTeacher: string; toTeacher: string; status: 'pending' | 'accepted' | 'declined' | 'applied';
}
const sameSide = (o: SwapSide, p: SwapSide) => o.section === p.section && o.code === p.code;
export function scheduleOn(iso: string, swaps: Swap[]): Occ[] {
  let occ: Occ[] = SLOTS.filter(s => s.day === dayOf(iso)).map(s => ({
    id: `${iso}-${s.section}-${s.code}`, iso, section: s.section, code: s.code, teacher: courseByCode(s.code).teacher,
    venue: s.venue, start: s.start, end: s.end, online: s.venue === 'Online',
  }));
  const appliedReschedules = swaps.filter(w => w.kind === 'reschedule' && w.status === 'applied');
  appliedReschedules.filter(w => w.sourceIso === iso).forEach(w => {
    occ = occ.filter(o => !sameSide(o, w.from));
  });
  appliedReschedules.filter(w => w.iso === iso && w.start !== undefined && w.end !== undefined && w.venue).forEach(w => {
    occ.push({
      id: `${w.id}-rescheduled`, iso, section: w.from.section, code: w.from.code, teacher: w.fromTeacher,
      venue: w.venue!, start: w.start!, end: w.end!, online: false, swapped: true, remark: 'Rescheduled',
    });
  });
  [...swaps].reverse().filter(w => w.kind !== 'reschedule' && (w.status === 'accepted' || w.status === 'applied') && w.iso === iso).forEach(w => {
    const a = occ.find(o => sameSide(o, w.from));
    if (!a) return;
    if (!w.to) {
      if (!w.venue) return;
      const old = a.venue;
      a.venue = w.venue; a.swapped = true; a.remark = `Venue changed from ${old} to ${w.venue}`;
      return;
    }
    const b = occ.find(o => sameSide(o, w.to!));
    if (!b) return;
    const [oa, ob] = [a.venue, b.venue];
    [a.venue, b.venue] = [b.venue, a.venue];
    if (w.kind === 'time') { [a.start, b.start] = [b.start, a.start]; [a.end, b.end] = [b.end, a.end]; }
    a.swapped = b.swapped = true;
    a.swappedWith = b.teacher; b.swappedWith = a.teacher;
    a.remark = w.kind === 'venue' ? `Venue changed from ${oa} to ${a.venue}` : `Swapped with ${b.teacher}`;
    b.remark = w.kind === 'venue' ? `Venue changed from ${ob} to ${b.venue}` : `Swapped with ${a.teacher}`;
  });
  return occ.sort((x, y) => x.start - y.start || x.section.localeCompare(y.section));
}

export function swapOptions(kind: 'venue' | 'time', mine: SwapSide, iso: string, swaps: Swap[]): Occ[] {
  const sched = scheduleOn(iso, swaps);
  const a = sched.find(o => sameSide(o, mine));
  if (!a || a.online || a.swapped || hasStarted(iso, a.start)) return [];
  const locked = swaps.filter(w => w.status !== 'declined' && w.iso === iso).flatMap(w => (w.to ? [w.from, w.to] : [w.from]));
  if (locked.some(l => sameSide(l, a))) return [];
  return sched.filter(b => {
    if (b === a || b.online || b.teacher === a.teacher || b.swapped || hasStarted(iso, b.start)) return false;
    if (locked.some(l => sameSide(l, b))) return false;
    if (kind === 'venue') return b.start === a.start && b.venue !== a.venue;
    if (b.start === a.start) return false;
    const rest = sched.filter(o => o !== a && o !== b);
    const clash = (who: (o: Occ) => boolean, at: number) => rest.some(o => who(o) && o.start === at);
    return !clash(o => o.teacher === a.teacher, b.start) && !clash(o => o.teacher === b.teacher, a.start) &&
      !clash(o => o.section === a.section, b.start) && !clash(o => o.section === b.section, a.start);
  });
}
export function freeRescheduleOptions(iso: string, source: SwapSide, swaps: Swap[]) {
  const sched = scheduleOn(iso, swaps);
  const teacher = courseByCode(source.code).teacher;
  return SLOT_STARTS.flatMap(start => {
    const clashes = sched.some(o => (o.teacher === teacher || o.section === source.section) && o.start === start);
    if (clashes || hasStarted(iso, start)) return [];
    const venues = CAMERA_VENUES.filter(venue => !sched.some(o => o.venue === venue && o.start === start));
    return venues.length ? [{ start, end: start + 60, venues }] : [];
  });
}
export const classLabel = (o: SwapSide) => `${courseByCode(o.code).short} (${o.section})`;

/* ---------- Class held rows (physical classes only) ---------- */
export type HeldStatus = 'Held On Time' | 'Late' | 'Not Held';
export const LATE_AFTER = 10;
export interface ReportRow {
  id: string; iso: string; section: string; code: string; teacher: string; venue: string;
  sched: number; end: number; actual: number | null; timeOut: number | null;
  lateIn: number; leftEarly: number; status: HeldStatus; remark: string;
}
const DEMO_STATUS: Record<string, HeldStatus> = {
  [`${TODAY}-BSCS-5A-CS-501`]: 'Not Held',
  [`${TODAY}-BSCS-5B-CS-501`]: 'Held On Time',
};
export function rowsOn(iso: string, swaps: Swap[]): ReportRow[] {
  if (iso > TODAY) return [];
  return scheduleOn(iso, swaps).filter(o => !o.online).map(o => {
    const r = rng(o.id), v = r(), w = r();
    const forced = DEMO_STATUS[o.id];
    const status: HeldStatus = forced ?? (v < 0.08 ? 'Not Held' : v < 0.26 ? 'Late' : 'Held On Time');
    const lateIn = status === 'Late' ? 11 + Math.floor(v * 1000) % 15 : Math.floor(v * 1000) % (LATE_AFTER + 1);
    const leftEarly = status !== 'Not Held' && w > 0.85 ? 5 + Math.floor(w * 100) % 11 : 0;
    const held = status !== 'Not Held';
    return {
      id: o.id, iso, section: o.section, code: o.code, teacher: o.teacher, venue: o.venue, sched: o.start, end: o.end,
      actual: held ? o.start + lateIn : null, timeOut: held ? o.end - leftEarly : null,
      lateIn: held ? lateIn : 0, leftEarly, status, remark: o.remark ?? '',
    };
  });
}
export function reportRows(swaps: Swap[], days = 15): ReportRow[] {
  const dates: string[] = [];
  for (let d = LAST_WORKDAY; dates.length < days; d = prevWeekday(d)) dates.push(d);
  return dates.flatMap(d => rowsOn(d, swaps).sort((a, b) => b.sched - a.sched));
}
export const DATE_MIN = addDays(TODAY, -90);
export const sessionsOf = (section: string, code: string, swaps: Swap[]) =>
  reportRows(swaps).filter(r => r.section === section && r.code === code && r.status !== 'Not Held');

export const MODULES = ['Mobile Usage', 'Sitting'] as const;
export type ModState = 'ready' | 'processing' | 'nodata';
export interface ModResult { name: (typeof MODULES)[number]; state: ModState; chip: string; summary: string }
export function moduleData(row: ReportRow): ModResult[] {
  return MODULES.map(name => {
    const r = rng(row.id + name);
    const v = r(), n = Math.floor(r() * 25);
    const state: ModState = row.iso === TODAY ? (v < 0.5 ? 'processing' : 'ready') : v < 0.07 ? 'nodata' : 'ready';
    const phones = n % 9 + 1, sitting = 70 + n;
    const ready = name === 'Mobile Usage'
      ? { chip: `Mobile ${phones}`, summary: `${phones} students were seen using phones` }
      : { chip: `Sitting ${sitting}%`, summary: `${sitting}% of students were seated properly` };
    return {
      name, state,
      chip: state === 'ready' ? ready.chip : state === 'processing' ? `${name === 'Sitting' ? 'Sitting' : 'Mobile'} ...` : `${name === 'Sitting' ? 'Sitting' : 'Mobile'} --`,
      summary: ready.summary,
    };
  });
}

/* ---------- Attendance shortage ---------- */
export interface Shortage { name: string; arid: string; section: string; code: string; attended: number; total: number }
const sh = (section: string, i: number, code: string, attended: number, total: number): Shortage => ({ ...rosterAt(section, i), section, code, attended, total });
export const SHORTAGE: Shortage[] = [
  sh('BSCS-5A', 6, 'CS-501', 12, 21),
  sh('BSCS-5A', 1, 'CS-505', 13, 21),
  sh('BSSE-3A', 5, 'CS-501', 13, 21),
  sh('BSCS-5B', 16, 'CS-501', 14, 21),
  sh('BSCS-5A', 11, 'CS-505', 14, 20),
  sh('BSCS-5A', 3, 'CS-503', 14, 21),
  sh('BSCS-5B', 9, 'CS-504', 14, 21),
  sh('BSCS-5A', 4, 'CS-504', 15, 21),
  sh('BSCS-5A', 0, 'CS-502', 16, 22),
];
export const pct = (s: Shortage) => Math.round((s.attended / s.total) * 100);
export const classesNeeded = (s: Shortage) => Math.max(0, Math.ceil((MIN_ATTENDANCE / 100 * s.total - s.attended) / (1 - MIN_ATTENDANCE / 100)));

/* ---------- Student sessions & disputes ---------- */
export interface StudentSession { id: string; code: string; date: string; time: string; detected: number }
export const STUDENT_SESSIONS: StudentSession[] = [
  { id: 's1', code: 'CS-501', date: '15 Oct 2026', time: '8:30 AM', detected: 10 },
  { id: 's2', code: 'CS-502', date: '14 Oct 2026', time: '10:30 AM', detected: 5 },
  { id: 's3', code: 'CS-505', date: '13 Oct 2026', time: '11:30 AM', detected: 9 },
  { id: 's4', code: 'CS-503', date: '12 Oct 2026', time: '2:00 PM', detected: 8 },
  { id: 's5', code: 'CS-501', date: '9 Oct 2026', time: '8:30 AM', detected: 6 },
  { id: 's6', code: 'CS-504', date: '8 Oct 2026', time: '9:30 AM', detected: 9 },
  { id: 's7', code: 'CS-502', date: '7 Oct 2026', time: '10:30 AM', detected: 3 },
  { id: 's8', code: 'CS-503', date: '5 Oct 2026', time: '2:00 PM', detected: 9 },
];

export type DisputeStatus = 'pending' | 'approved' | 'rejected';
export interface Dispute {
  id: string; sessionId: string; student: string; arid: string; code: string; date: string; time: string;
  reason: string; hasPhoto: boolean; status: DisputeStatus; comment: string; detected: number;
}
const dsp = (id: string, sessionId: string, i: number, code: string, date: string, time: string, reason: string, hasPhoto: boolean, status: DisputeStatus, comment: string, detected: number): Dispute =>
  ({ id, sessionId, student: rosterAt('BSCS-5A', i).name, arid: rosterAt('BSCS-5A', i).arid, code, date, time, reason, hasPhoto, status, comment, detected });
export const INITIAL_DISPUTES: Dispute[] = [
  dsp('d1', 's5', 0, 'CS-501', '9 Oct 2026', '8:30 AM', 'I sat in the third row but the camera did not pick me up.', false, 'pending', '', 6),
  dsp('d2', 'x2', 8, 'CS-505', '13 Oct 2026', '11:30 AM', 'I was present for the full lecture and wore a mask that day.', true, 'pending', '', 5),
  dsp('d3', 'x3', 9, 'CS-501', '8 Oct 2026', '8:30 AM', 'Seated behind the projector pillar for most of the class.', false, 'approved', 'Verified from captures. Marked present.', 7),
  dsp('d4', 'x4', 3, 'CS-505', '8 Oct 2026', '11:30 AM', 'I attended but left my seat to use the lab terminal.', false, 'rejected', 'Not visible in any capture after the first.', 2),
  dsp('d5', 'x5', 12, 'CS-502', '14 Oct 2026', '10:30 AM', 'Camera angle missed my row.', false, 'pending', '', 6),
];

/* ---------- Notifications ---------- */
export type NoticeType = 'timetable' | 'shortage' | 'dispute' | 'report' | 'swap' | 'change' | 'remark';
export interface Notice {
  id: string; type: NoticeType; title: string; body: string; mins: number; roles: Role[];
  teachers?: string[]; sections?: string[]; swapId?: string; remarkId?: string;
}
export const NOTICE_LABEL: Record<NoticeType, string> = {
  timetable: 'Timetable', shortage: 'Shortage', dispute: 'Dispute', report: 'Report', swap: 'Swap request', change: 'Timetable change', remark: 'Director remark',
};
export const noticeVisible = (n: Notice, role: Role) =>
  n.roles.includes(role) &&
  (role !== 'teacher' || !n.teachers || n.teachers.includes(TEACHER)) &&
  (role !== 'student' || !n.sections || n.sections.includes(STUDENT.section));
export const SEED_NOTICES: Notice[] = [
  { id: 'n1', type: 'report', title: 'CS-501 Report Ready', body: 'Class activity analysis is complete for today\'s lecture', mins: 5, roles: ['teacher', 'admin', 'director'] },
  { id: 'n8', type: 'report', title: `CHR for ${fmtDate(LAST_WORKDAY)} is ready`, body: 'The Class Held Report is available in Reports', mins: 30, roles: ['director'] },
  { id: 'n2', type: 'shortage', title: 'Attendance Shortage', body: `${SHORTAGE.filter(x => isOwn(x.code)).length} students in CS-501 and CS-505 are below 75%`, mins: 120, roles: ['teacher'] },
  { id: 'n3', type: 'shortage', title: 'Attendance Shortage', body: 'Your CS-502 attendance is 73%, below the 75% minimum', mins: 180, roles: ['student'] },
  { id: 'n4', type: 'shortage', title: 'Attendance Shortage', body: `${SHORTAGE.length} students are below the 75% threshold institution-wide`, mins: 240, roles: ['admin', 'director'] },
  { id: 'n5', type: 'timetable', title: 'Timetable Updated', body: 'Wednesday schedule changed. Check Lt and Lab assignments', mins: 1440, roles: ['teacher', 'student', 'admin'] },
  { id: 'n6', type: 'report', title: 'Weekly Reports Ready', body: 'Class Activity reports for the last working week', mins: 2880, roles: ['admin'] },
  { id: 'n9', type: 'report', title: 'Weekly Reports Ready', body: 'Class Held and Class Activity reports for the last working week', mins: 2880, roles: ['director'] },
  { id: 'n7', type: 'dispute', title: 'New Dispute', body: 'Sara Ahmed raised a dispute for CS-505 · 13 Oct', mins: 3000, roles: ['teacher'] },
];
export function seedIncomingSwap(): Swap | null {
  for (let i = 1; i <= 14; i++) {
    const iso = addDays(TODAY, i);
    if (!isWeekday(iso)) continue;
    for (const o of scheduleOn(iso, [])) {
      if (o.teacher !== 'Dr. Sara Malik') continue;
      const t = swapOptions('venue', o, iso, []).find(b => b.teacher === TEACHER);
      if (t) return { id: 'sw-seed', kind: 'venue', iso, from: { section: o.section, code: o.code }, to: { section: t.section, code: t.code }, venue: t.venue, fromVenue: o.venue, fromTeacher: o.teacher, toTeacher: TEACHER, status: 'pending' };
    }
  }
  return null;
}
export const ago = (m: number) => m === 0 ? 'Just now' : m < 60 ? `${m} mins ago` : m < 1440 ? `${Math.round(m / 60)} hours ago` : `${Math.round(m / 1440)} days ago`;

/* ---------- Institution summary ---------- */
export const TREND: Record<string, number[]> = {
  'BSCS-5A': [88, 86, 87, 84, 82, 85, 83, 86],
  'BSCS-5B': [82, 80, 83, 79, 78, 81, 77, 80],
  'BSSE-3A': [91, 90, 88, 89, 87, 88, 86, 87],
};
export const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
export const heldPct = (rows: ReportRow[]) => rows.length ? Math.round((rows.filter(r => r.status !== 'Not Held').length / rows.length) * 100) : 0;
export const totalStudents = (keys: string[]) => keys.reduce((n, k) => n + SECTION_SIZE[k], 0);

export const timeOf = (iso: string, side: SwapSide, swaps: Swap[]) => scheduleOn(iso, swaps).find(o => sameSide(o, side));
export const venueOccupant = (venue: string, iso: string, start: number, swaps: Swap[]) =>
  scheduleOn(iso, swaps).find(o => !o.online && o.venue === venue && o.start === start);
export const swapRequestText = (w: Swap, start: number) =>
  `Swap request: ${w.fromTeacher} wants ${w.venue} on ${fmtDate(w.iso)}, ${fmtTime(start)}. Your class would move to ${w.fromVenue}.`;
export const fmtStamp = (ms: number) => {
  const d = new Date(ms);
  return `${fmtDate(toIso(d))}, ${fmtTime(d.getHours() * 60 + d.getMinutes())}`;
};
