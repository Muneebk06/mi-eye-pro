import './globals.css';

export const metadata = {
  title: 'MEye-Pro — BIIT AI Classroom Monitor',
  description: 'AI Classroom Monitoring & Attendance System',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
