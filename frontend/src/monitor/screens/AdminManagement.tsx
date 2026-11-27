import { useState } from 'react';
import { Screen } from '../types';
import ManageList, { Rec } from './ManageList';

const SEED: Rec[] = [
  { id: 'a1', name: 'Nadia Hussain', email: 'nadia.hussain@biit.edu.pk', role: 'Admin', password: '', status: 'Active' },
  { id: 'a2', name: 'Kamran Yousaf', email: 'kamran.yousaf@biit.edu.pk', role: 'Admin', password: '', status: 'Active' },
  { id: 'a3', name: 'Prof. Tariq Mehmood', email: 'tariq.mehmood@biit.edu.pk', role: 'Director', password: '', status: 'Active' },
];

export default function AdminManagement({ navigate }: { navigate: (s: Screen) => void }) {
  const [items, setItems] = useState<Rec[]>(SEED);
  return (
    <ManageList
      title="Admin Management" noun="Account" onBack={() => navigate('adminPanel')}
      items={items} setItems={f => setItems(f)}
      stickyKey="adminMgmt" searchPlaceholder="Search name or email" searchKeys={['name', 'email']}
      filterGroups={[{ key: 'role', label: 'Role', options: ['Admin', 'Director'] }, { key: 'status', label: 'Status', options: ['Active', 'Inactive'] }]}
      primary={r => r.name} secondary={r => `${r.role} · ${r.email}`}
      fields={[
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email', type: 'email' },
        { key: 'role', label: 'Role', type: 'select', options: ['Admin', 'Director'] },
        { key: 'password', label: 'Password', type: 'password' },
      ]}
    />
  );
}
