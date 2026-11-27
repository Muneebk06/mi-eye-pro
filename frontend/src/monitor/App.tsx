import { useLayoutEffect, useRef, useState } from 'react';
import { Role, Screen } from './types';

import BottomNav from './components/BottomNav';
import Login from './screens/Login';
import StudentDashboard from './screens/StudentDashboard';
import AdminDashboard from './screens/AdminDashboard';
import DirectorDashboard from './screens/DirectorDashboard';
import Timetable from './screens/Timetable';
import Notifications from './screens/Notifications';
import DisputeManagement from './screens/DisputeManagement';
import RaiseDispute from './screens/RaiseDispute';
import AdminPanel from './screens/AdminPanel';
import AdminAnalytics from './screens/AdminAnalytics';
import RegisterStudent from './screens/RegisterStudent';
import ClassArchive from './screens/ClassArchive';
import AttendanceShortage from './screens/AttendanceShortage';
import MySessionHistory from './screens/MySessionHistory';
import Reports from './screens/Reports';
import Upload from './screens/Upload';
import TeacherManagement from './screens/TeacherManagement';
import AdminManagement from './screens/AdminManagement';
import CameraManagement from './screens/CameraManagement';
import ChangePassword from './screens/ChangePassword';
import MyClasses from './screens/MyClasses';
import SwapRequest from './screens/SwapRequest';
import Reschedule from './screens/Reschedule';
import MySwaps from './screens/MySwaps';
import ClassDetail from './screens/ClassDetail';
import RemarkScreen from './screens/Remark';
import Alerts from './screens/Alerts';
import TeacherHome from './screens/TeacherHome';
import { ALERT_COUNT } from './screens/Alerts';
import AppDrawer, { DrawerItem } from './components/AppDrawer';
import StudentManagement from './screens/StudentManagement';
import AdminAttendance from './screens/AdminAttendance';
import StudentAttendanceDetail from './screens/StudentAttendanceDetail';
import { SwapCtx } from './SwapContext';
import { Remark, RemarkCtx } from './RemarkContext';
import { ReportRow, TEACHER, TEACHER_EMP, SEED_NOTICES, TODAY, Dispute, INITIAL_DISPUTES, Notice, STUDENT, STUDENT_SESSIONS, StudentSession, Swap, SwapSide, classLabel, courseByCode, fmtDate, fmtTime, hasStarted, noticeVisible, scheduleOn, seedIncomingSwap, swapRequestText } from './data';

const ALLOWED: Record<Screen, Role[]> = {
  login: ['teacher', 'student', 'admin', 'director'],
  dashboard: ['teacher', 'student', 'admin', 'director'],
  timetable: ['student', 'admin'],
  notifications: ['teacher', 'student', 'admin', 'director'],
  changePassword: ['teacher', 'student', 'admin', 'director'],
  disputes: ['teacher'],
  raiseDispute: ['student'],
  mySessionHistory: ['student'],
  attendanceShortage: ['teacher', 'admin', 'director'],
  reports: ['teacher', 'admin', 'director'],
  classArchive: ['teacher', 'admin', 'director'],
  adminAnalytics: ['admin'],
  adminPanel: ['admin'],
  upload: ['admin'],
  registerStudent: ['admin'],
  teacherMgmt: ['admin'],
  adminMgmt: ['admin'],
  cameraMgmt: ['admin'],
  myClasses: ['teacher'],
  swapRequest: ['teacher'],
  reschedule: ['teacher'],
  mySwaps: ['teacher'],
  chrDetail: ['director'],
  remark: ['teacher'],
  alerts: ['teacher'],
  studentMgmt: ['admin'],
  attendance: ['admin'],
  studentAttendance: ['admin'],
};

const ADMIN_NAME = 'Nadia Hussain';
const DIRECTOR_NAME = 'Prof. Tariq Mehmood';

export default function App({ initialRole = null, initialScreen = "dashboard" }: { initialRole?: Role | null; initialScreen?: Screen }) {
  const [role, setRole] = useState<Role | null>(initialRole);
  const [screen, setScreen] = useState<Screen>(initialRole ? initialScreen : 'login');
  const [disputes, setDisputes] = useState<Dispute[]>(INITIAL_DISPUTES);
  const [swaps, setSwaps] = useState<Swap[]>(() => { const w = seedIncomingSwap(); return w ? [w] : []; });
  const [notices, setNotices] = useState<Notice[]>(() => {
    const w = seedIncomingSwap();
    if (!w) return [];
    return [{ id: 'x-seed', type: 'swap', title: 'Swap request', mins: 45, roles: ['teacher'], teachers: [w.toTeacher], swapId: w.id, body: swapRequestText(w, scheduleOn(w.iso, []).find(o => o.section === w.from.section && o.code === w.from.code)!.start) }];
  });
  const [swapTarget, setSwapTarget] = useState<(SwapSide & { iso: string }) | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<(SwapSide & { iso: string }) | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sessionCourse, setSessionCourse] = useState('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [attArid, setAttArid] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [sessionsInit, setSessionsInit] = useState<{ tab: 'sessions' | 'disputes'; k: number }>({ tab: 'sessions', k: 0 });
  const [pwBack, setPwBack] = useState<Screen>('dashboard');

  const [remarks, setRemarks] = useState<Remark[]>([]);
  const [chrRow, setChrRow] = useState<ReportRow | null>(null);
  const [reportsTab, setReportsTab] = useState<'chr' | 'activity'>('chr');
  const [reportsDate, setReportsDate] = useState(TODAY);
  const [remarkId, setRemarkId] = useState<string | null>(null);
  const [remarkBack, setRemarkBack] = useState<Screen>('notifications');
  const chrScroll = useRef<number | null>(null);

  const pushNotice = (n: Omit<Notice, 'id' | 'mins'>) => setNotices(p => [{ ...n, id: `x${Date.now()}`, mins: 0 }, ...p]);

  const raiseDispute = (s: StudentSession, reason: string, hasPhoto: boolean) => {
    if (disputes.some(d => d.sessionId === s.id)) return;
    setDisputes(d => [{ id: `d-${s.id}`, sessionId: s.id, student: STUDENT.name, arid: STUDENT.arid, code: s.code, date: s.date, time: s.time, reason, hasPhoto, status: 'pending', comment: '', detected: s.detected }, ...d]);
    pushNotice({ type: 'dispute', title: 'New Dispute', body: `${STUDENT.name} raised a dispute for ${s.code} · ${s.date}`, roles: ['teacher'] });
  };

  const decideDispute = (id: string, decision: 'approved' | 'rejected', comment: string) => {
    const d = disputes.find(x => x.id === id);
    if (!d) return;
    setDisputes(list => list.map(x => (x.id === id ? { ...x, status: decision, comment } : x)));
    if (d.arid === STUDENT.arid) {
      pushNotice({
        type: 'dispute',
        title: decision === 'approved' ? 'Dispute Approved' : 'Dispute Rejected',
        body: `${d.code} · ${d.date}: ${decision === 'approved' ? 'attendance changed to Present' : 'attendance stays Absent'}. Teacher comment: ${comment || 'none'}`,
        roles: ['student'],
      });
    }
  };

  const sendSwap = (kind: 'venue' | 'time', iso: string, from: SwapSide, to: SwapSide, venue?: string) => {
    const [a, b] = [from, to].map(x => scheduleOn(iso, swaps).find(o => o.section === x.section && o.code === x.code)!);
    const w: Swap = { id: `sw-${Date.now()}`, kind, iso, from, to, venue: kind === 'venue' ? b.venue : undefined, fromVenue: kind === 'venue' ? a.venue : undefined, fromTeacher: a.teacher, toTeacher: b.teacher, status: 'pending' };
    setSwaps(l => [w, ...l]);
    pushNotice({
      type: 'swap', title: 'Swap request', roles: ['teacher'], teachers: [b.teacher], swapId: w.id,
      body: kind === 'venue'
        ? swapRequestText(w, a.start)
        : `${a.teacher} asks for a ${kind} swap on ${fmtDate(iso)}: ${classLabel(from)} (${fmtTime(a.start)}, ${a.venue}) with your ${classLabel(to)} (${fmtTime(b.start)}, ${b.venue}).`,
    });
  };

  const reschedule = (sourceIso: string, from: SwapSide, iso: string, start: number, venue: string) => {
    const source = scheduleOn(sourceIso, swaps).find(o => o.section === from.section && o.code === from.code);
    const target = scheduleOn(iso, swaps);
    const teacher = source?.teacher ?? courseByCode(from.code).teacher;
    if (!source || hasStarted(iso, start) || target.some(o => o.start === start && (o.teacher === teacher || o.section === from.section || o.venue === venue))) return false;
    const w: Swap = {
      id: `rs-${Date.now()}`, kind: 'reschedule', sourceIso, iso, from, venue, start, end: start + 60,
      fromTeacher: teacher, toTeacher: teacher, status: 'applied',
    };
    setSwaps(list => [w, ...list]);
    const body = `${courseByCode(from.code).short} (${from.section}) rescheduled to ${fmtDate(iso)}, ${fmtTime(start)} in ${venue}.`;
    pushNotice({ type: 'change', title: 'Lecture rescheduled', roles: ['student'], sections: [from.section], body });
    pushNotice({ type: 'change', title: 'Lecture rescheduled', roles: ['admin', 'director'], body });
    return true;
  };

  const decideSwap = (id: string, decision: 'accepted' | 'declined') => {
    const w = swaps.find(x => x.id === id);
    if (!w || w.status !== 'pending' || !w.to) return;
    const next = swaps.map(x => (x.id === id ? { ...x, status: decision } : x));
    setSwaps(next);
    const what = w.kind === 'venue' ? `venue swap (${w.fromVenue} to ${w.venue})` : 'time swap';
    pushNotice({ type: 'swap', title: `Swap ${decision}`, roles: ['teacher'], teachers: [w.fromTeacher], swapId: id, body: `${w.toTeacher} ${decision} your ${what} on ${fmtDate(w.iso)}.` });
    if (decision === 'declined') return;
    const sched = scheduleOn(w.iso, next);
    const [a, b] = [w.from, w.to].map(x => sched.find(o => o.section === x.section && o.code === x.code)!);
    if (w.kind === 'venue') {
      const [oa, ob] = [w.fromVenue, w.venue];
      const msg = (o: typeof a, from?: string, to?: string) => `Venue changed: ${courseByCode(o.code).short}, ${from} to ${to} (${fmtDate(w.iso)} only).`;
      pushNotice({ type: 'change', title: 'Timetable change', roles: ['teacher'], teachers: [a.teacher, b.teacher], body: `${fmtDate(w.iso)} only: ${courseByCode(a.code).short} (${a.section}) is now in ${a.venue}; ${courseByCode(b.code).short} (${b.section}) is now in ${b.venue}.` });
      pushNotice({ type: 'change', title: 'Timetable change', roles: ['student'], sections: [a.section], body: msg(a, oa, ob) });
      if (b.section !== a.section) pushNotice({ type: 'change', title: 'Timetable change', roles: ['student'], sections: [b.section], body: msg(b, ob, oa) });
      pushNotice({ type: 'change', title: 'Swap completed', roles: ['admin', 'director'], body: `${fmtDate(w.iso)}: ${courseByCode(a.code).short} (${a.section}) and ${courseByCode(b.code).short} (${b.section}) exchanged venues.` });
      return;
    }
    const line = (o: typeof a) => `${courseByCode(o.code).short} (${o.section}) is now ${fmtTime(o.start)} in ${o.venue}`;
    const body = `${fmtDate(w.iso)} only: ${line(a)}; ${line(b)}.`;
    pushNotice({ type: 'change', title: 'Timetable change', roles: ['teacher'], teachers: [a.teacher, b.teacher], body });
    pushNotice({ type: 'change', title: 'Timetable change', roles: ['student'], sections: [a.section, b.section], body });
    pushNotice({ type: 'change', title: 'Swap completed', roles: ['admin', 'director'], body });
  };

  const sendRemark = async (row: ReportRow, text: string) => {
    await new Promise(r => setTimeout(r, 700));
    if (remarks.some(m => m.id === row.id)) return;
    const label = `${courseByCode(row.code).short} - ${row.section}`;
    setRemarks(p => [...p, { id: row.id, iso: row.iso, section: row.section, code: row.code, teachers: [row.teacher], text, sentAt: Date.now(), status: 'delivered' }]);
    pushNotice({ type: 'remark', title: 'Director remark', roles: ['teacher'], teachers: [row.teacher], remarkId: row.id, body: `Director remark on ${label}, ${fmtDate(row.iso)}: ${text.slice(0, 60)}${text.length > 60 ? '...' : ''}` });
  };
  const markSeen = (id: string) => setRemarks(p => p.map(m => (m.id === id && m.status === 'delivered' ? { ...m, status: 'seen' } : m)));
  const openRemark = (id: string, from: Screen) => { setRemarkId(id); setRemarkBack(from); setScreen('remark'); };
  const openChr = (r: ReportRow) => { chrScroll.current = window.scrollY; setChrRow(r); setScreen('chrDetail'); };

  const logout = () => { window.history.replaceState(null, '', '/login'); setRole(null); setScreen('login'); setSelectedId(null); };
  const navigate = (s: Screen) => { if (s === 'changePassword') setPwBack(screen); if (s !== 'mySessionHistory' && s !== 'raiseDispute') setSessionCourse('all'); setScreen(s); };

  const roleHome = 'dashboard';
  const current: Screen = role && ALLOWED[screen].includes(role) ? screen : role ? roleHome : 'login';
  useLayoutEffect(() => {
    if (current === 'reports' && chrScroll.current !== null) { window.scrollTo(0, chrScroll.current); chrScroll.current = null; }
  }, [current]);
  const openMenu = () => setDrawerOpen(true);
  const pendingSwaps = swaps.filter(w => w.kind !== 'reschedule' && w.toTeacher === TEACHER && w.status === 'pending').length;
  const bell = role === 'teacher' ? remarks.filter(m => m.status === 'delivered' && m.teachers.includes(TEACHER)).length : 0;
  const showBottomNav = role !== null && current !== 'login';
  const dispute = disputes.find(d => d.sessionId === selectedId);

  const adminAlerts = [...notices, ...SEED_NOTICES].filter(n => noticeVisible(n, 'admin')).length;
  const noticeCount = (r: Role) => [...notices, ...SEED_NOTICES].filter(n => noticeVisible(n, r)).length;
  const alertsItem = (r: Role): DrawerItem => ({ label: 'Alerts', icon: 'bell', screen: r === 'teacher' ? 'alerts' : 'notifications', badge: r === 'teacher' ? ALERT_COUNT : noticeCount(r) });
  const pwItem: DrawerItem = { label: 'Change Password', icon: 'lock', screen: 'changePassword' };
  const drawerItems: DrawerItem[] = role === 'student'
    ? [alertsItem('student'), { label: 'My Disputes', icon: 'disputes', screen: 'mySessionHistory', onSelect: () => { setSessionsInit(p => ({ tab: 'disputes', k: p.k + 1 })); setSelectedId(null); setScreen('mySessionHistory'); } }, pwItem]
    : role === 'teacher'
    ? [alertsItem('teacher'), { label: 'My Swaps', icon: 'swap', screen: 'mySwaps', badge: pendingSwaps }, { label: 'Reports', icon: 'reports', screen: 'reports' }, pwItem]
    : [alertsItem(role ?? 'admin'), pwItem];
  const drawerWho: Record<Role, { name: string; line: string }> = {
    student: { name: STUDENT.name, line: `Arid No. ${STUDENT.arid} · ${STUDENT.section}` },
    teacher: { name: TEACHER, line: `Employee No. ${TEACHER_EMP} · Computer Science` },
    admin: { name: ADMIN_NAME, line: 'Admin' },
    director: { name: DIRECTOR_NAME, line: 'Director' },
  };

  const render = () => {
    if (!role || current === 'login') return <Login onLogin={r => { window.history.replaceState(null, '', '/' + r); setRole(r); setScreen('dashboard'); }} />;
    switch (current) {
      case 'dashboard':
        if (role === 'teacher') return <TeacherHome navigate={navigate} onMenu={openMenu} />;
        if (role === 'student') return <StudentDashboard navigate={navigate} onMenu={openMenu} onOpenCourse={code => { setSessionCourse(code); setSelectedId(null); setScreen('mySessionHistory'); }} />;
        if (role === 'director') return <DirectorDashboard navigate={navigate} onMenu={openMenu} />;
        return <AdminDashboard navigate={navigate} onMenu={openMenu} />;
      case 'timetable': return <Timetable navigate={navigate} role={role} onMenu={role === 'student' ? openMenu : undefined} />;
      case 'notifications': return <Notifications navigate={navigate} role={role} extra={notices.filter(n => noticeVisible(n, role))} onOpenRemark={id => openRemark(id, 'notifications')} />;
      case 'disputes': return <DisputeManagement navigate={navigate} onMenu={openMenu} disputes={disputes} onDecide={decideDispute} />;
      case 'raiseDispute':
        return <RaiseDispute navigate={navigate} session={STUDENT_SESSIONS.find(s => s.id === selectedId)} dispute={dispute} onSubmit={raiseDispute} />;
      case 'mySessionHistory':
        return <MySessionHistory key={sessionsInit.k} initialTab={sessionsInit.tab} onMenu={openMenu} navigate={navigate} disputes={disputes} selectedId={selectedId} setSelectedId={setSelectedId} course={sessionCourse} setCourse={setSessionCourse} />;
      case 'attendanceShortage': return <AttendanceShortage navigate={navigate} role={role} onMenu={openMenu} />;
      case 'reports': return <Reports navigate={navigate} role={role} tab={reportsTab} setTab={setReportsTab} date={reportsDate} setDate={setReportsDate} onOpenChr={openChr} onMenu={openMenu} />;
      case 'classArchive': return <ClassArchive navigate={navigate} role={role} onMenu={openMenu} />;
      case 'adminAnalytics': return <AdminAnalytics navigate={navigate} role={role} />;
      case 'adminPanel': return <AdminPanel navigate={navigate} onMenu={openMenu} />;
      case 'upload': return <Upload navigate={navigate} />;
      case 'registerStudent': return <RegisterStudent navigate={navigate} />;
      case 'teacherMgmt': return <TeacherManagement navigate={navigate} />;
      case 'adminMgmt': return <AdminManagement navigate={navigate} />;
      case 'cameraMgmt': return <CameraManagement navigate={navigate} />;
      case 'myClasses': return <MyClasses navigate={navigate} onMenu={openMenu} onSwap={o => { setSwapTarget({ iso: o.iso, section: o.section, code: o.code }); navigate('swapRequest'); }} onReschedule={o => { setRescheduleTarget({ iso: o.iso, section: o.section, code: o.code }); navigate('reschedule'); }} />;
      case 'swapRequest': return <SwapRequest navigate={navigate} target={swapTarget} initialKind="time" />;
      case 'reschedule': return <Reschedule navigate={navigate} target={rescheduleTarget} />;
      case 'mySwaps': return <MySwaps navigate={navigate} />;
      case 'chrDetail': return <ClassDetail navigate={navigate} row={chrRow} />;
      case 'remark': return <RemarkScreen navigate={navigate} id={remarkId} back={remarkBack} />;
      case 'studentMgmt': return <StudentManagement navigate={navigate} />;
      case 'attendance': return <AdminAttendance navigate={navigate} onMenu={openMenu} onOpenStudent={a => { setAttArid(a); setScreen('studentAttendance'); }} />;
      case 'studentAttendance': return <StudentAttendanceDetail navigate={navigate} arid={attArid} />;
      case 'alerts': return <Alerts navigate={navigate} />;
      case 'changePassword': return <ChangePassword onBack={() => setScreen(pwBack === 'changePassword' ? 'dashboard' : pwBack)} />;
      default: return null;
    }
  };

  return (
    <SwapCtx.Provider value={{ swaps, send: sendSwap, reschedule, decide: decideSwap }}>
      <RemarkCtx.Provider value={{ remarks, bell, send: sendRemark, markSeen, openRemark }}>
      <div className={role ? "workspace signed-in" : "workspace"}>
        <div className="flex flex-col min-h-screen">
          <div className="flex-1">{render()}</div>
          {showBottomNav && <BottomNav current={current} role={role!} navigate={navigate} />}
        </div>
        {role && (
          <AppDrawer
            open={drawerOpen}
            pushEnabled={pushEnabled}
            name={drawerWho[role].name}
            roleLine={drawerWho[role].line}
            items={drawerItems}
            onClose={() => setDrawerOpen(false)}
            onNavigate={navigate}
            onTogglePush={() => setPushEnabled(enabled => !enabled)}
            onLogout={logout}
          />
        )}
      </div>
      </RemarkCtx.Provider>
    </SwapCtx.Provider>
  );
}
