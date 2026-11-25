export function detectRole(identifier) {
  const value = identifier.trim().toLowerCase();
  if (value.includes('arid')) return 'student';
  if (value.includes('admin')) return 'admin';
  if (value.includes('director')) return 'director';
  return 'teacher';
}
