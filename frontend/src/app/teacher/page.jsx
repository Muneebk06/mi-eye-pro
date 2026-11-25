import Link from 'next/link';

export default function TeacherDashboardPage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold text-slate-900">Teacher Dashboard</h1>
      <Link href="/login" className="mt-4 inline-block text-sm text-green-700 underline">
        Back to Login
      </Link>
    </main>
  );
}
