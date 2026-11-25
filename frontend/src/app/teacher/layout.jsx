import AppShell from '@/components/AppShell';

export default function TeacherLayout({ children }) {
  return (
    <AppShell
      role="teacher"
      userName="Prof. Ahmed"
      userSubtitle="Computer Science"
    >
      {children}
    </AppShell>
  );
}
