export const ROLE_NAV = {
  teacher: [
    { label: 'Dashboard', href: '/teacher' },
    { label: 'My Classes', href: '/teacher/classes' },
    { label: 'Disputes', href: '/teacher/disputes' },
    { label: 'Reports', href: '/teacher/reports' },
  ],
  student: [
    { label: 'Dashboard', href: '/student' },
    { label: 'Sessions', href: '/student/sessions' },
    { label: 'Timetable', href: '/student/timetable' },
    { label: 'Raise Dispute', href: '/student/dispute' },
  ],
  admin: [
    { label: 'Dashboard', href: '/admin' },
    { label: 'Attendance', href: '/admin/attendance' },
    { label: 'Admin Panel', href: '/admin/panel' },
    { label: 'Reports', href: '/admin/reports' },
  ],
  director: [
    { label: 'Dashboard', href: '/director' },
    { label: 'Reports', href: '/director/reports' },
    { label: 'Shortage', href: '/director/shortage' },
    { label: 'Archive', href: '/director/archive' },
  ],
};
