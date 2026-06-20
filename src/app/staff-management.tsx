import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AccessGate from '@/components/AccessGate';
import Dropdown from '@/components/Dropdown';
import ScreenState from '@/components/ScreenState';
import { useApi } from '@/lib/useApi';

// Converted from app/staff-management/StaffClient.tsx — mobile adaptation.
// Table -> staff cards. Slide-over panel -> Modal form. Local create/edit/delete over
// mock data until the backend feed is wired up.

type Staff = { id: number; name: string; email: string; role: string; branch: string };

const ROLE_BADGE: Record<string, string> = {
  SUPERADMIN: 'bg-violet-100 text-violet-700',
  ADMIN_HQ: 'bg-emerald-100 text-emerald-700',
  USER_RM: 'bg-amber-100 text-amber-700',
  USER_BM: 'bg-sky-100 text-sky-700',
};

const ROLE_OPTIONS = [
  { label: 'Branch Manager', value: 'USER_BM' },
  { label: 'Regional Manager', value: 'USER_RM' },
  { label: 'Admin HQ', value: 'ADMIN_HQ' },
  { label: 'Superadmin', value: 'SUPERADMIN' },
];

const emptyForm = { name: '', email: '', password: '', role: 'USER_BM', branch: '' };

export default function StaffManagementScreen() {
  return (
    <AccessGate page="/staff-management">
      <StaffManagementScreenInner />
    </AccessGate>
  );
}

function StaffManagementScreenInner() {
  const router = useRouter();
  // Live data from the backend (same query as the web staff page).
  const { data, loading, error: loadError, reload } = useApi<{ staff: Staff[] }>('/api/mobile/staff');
  const [staff, setStaff] = useState<Staff[]>([]);
  useEffect(() => {
    if (data?.staff) setStaff(data.staff);
  }, [data]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const admins = staff.filter((s) => s.role === 'ADMIN_HQ' || s.role === 'SUPERADMIN').length;
  const bms = staff.filter((s) => s.role === 'USER_BM').length;

  const openCreate = () => { setEditId(null); setForm(emptyForm); setError(''); setPanelOpen(true); };
  const openEdit = (s: Staff) => {
    setEditId(s.id);
    setForm({ name: s.name, email: s.email, password: '', role: s.role, branch: s.branch === '—' ? '' : s.branch });
    setError('');
    setPanelOpen(true);
  };

  const save = () => {
    if (!form.name || !form.email || !form.role) { setError('Name, email, and role are required.'); return; }
    if (editId === null && !form.password) { setError('Password is required for new accounts.'); return; }
    const branch = form.role === 'USER_BM' ? (form.branch || '—') : '—';
    if (editId === null) {
      setStaff((p) => [...p, { id: Math.max(0, ...p.map((s) => s.id)) + 1, name: form.name, email: form.email, role: form.role, branch }]);
    } else {
      setStaff((p) => p.map((s) => (s.id === editId ? { ...s, name: form.name, email: form.email, role: form.role, branch } : s)));
    }
    setPanelOpen(false);
  };

  const del = (s: Staff) =>
    Alert.alert('Delete staff', `Delete "${s.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => setStaff((p) => p.filter((x) => x.id !== s.id)) },
    ]);

  const setField = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <ScrollView contentContainerClassName="p-4 gap-4 pb-10" showsVerticalScrollIndicator={false}>
        {/* TOP BAR */}
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => router.push('/home')}>
            <Text className="text-[11px] font-black text-slate-400 uppercase tracking-widest">← Central Panel</Text>
          </Pressable>
          <View className="border border-violet-200 bg-violet-50 px-3 py-1 rounded-full">
            <Text className="text-[10px] font-black text-violet-600 uppercase tracking-[2px]">Superadmin</Text>
          </View>
        </View>

        {/* HEADING + ADD */}
        <View className="flex-row items-end justify-between">
          <View>
            <Text className="text-3xl font-black tracking-tight text-slate-900">Staff Management</Text>
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-[2px] mt-1">Accounts & access</Text>
          </View>
          <Pressable onPress={openCreate} className="bg-violet-600 px-5 py-3 rounded-2xl active:scale-95">
            <Text className="text-[11px] font-black uppercase tracking-widest text-white">+ Add</Text>
          </Pressable>
        </View>

        {/* STATS */}
        <View className="flex-row gap-3">
          <Stat label="Accounts" value={staff.length} color="text-slate-800" />
          <Stat label="Admins" value={admins} color="text-violet-600" />
          <Stat label="Managers" value={bms} color="text-sky-600" />
        </View>

        {/* LOADING / ERROR / EMPTY */}
        <ScreenState
          loading={loading}
          error={loadError}
          empty={!loading && !loadError && staff.length === 0}
          onRetry={reload}
          emptyText="No staff accounts"
        />

        {/* STAFF CARDS */}
        {!loading && !loadError && staff.map((s) => (
          <View key={s.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
            <View className="flex-row justify-between items-start">
              <View className="flex-1 pr-3">
                <Text className="font-black text-slate-800 text-base">{s.name}</Text>
                <Text className="text-sm font-medium text-slate-500 mt-0.5">{s.email}</Text>
                <View className="flex-row items-center gap-2 mt-2">
                  <View className={`px-3 py-1 rounded-full ${ROLE_BADGE[s.role] ?? 'bg-slate-100'}`}>
                    <Text className={`text-[9px] font-black uppercase tracking-widest ${(ROLE_BADGE[s.role] ?? 'text-slate-600').split(' ')[1]}`}>{s.role}</Text>
                  </View>
                  <Text className="text-xs font-bold text-slate-500">{s.branch}</Text>
                </View>
              </View>
            </View>
            <View className="flex-row gap-2 mt-4">
              <Pressable onPress={() => openEdit(s)} className="flex-1 bg-slate-100 py-2.5 rounded-xl items-center active:bg-slate-200">
                <Text className="text-[10px] font-black uppercase tracking-widest text-slate-700">Edit</Text>
              </Pressable>
              <Pressable onPress={() => del(s)} className="flex-1 bg-rose-50 border border-rose-200 py-2.5 rounded-xl items-center active:bg-rose-100">
                <Text className="text-[10px] font-black uppercase tracking-widest text-rose-600">Delete</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* FORM MODAL */}
      <Modal visible={panelOpen} transparent animationType="slide" onRequestClose={() => setPanelOpen(false)}>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-[32px] max-h-[88%]">
            <View className="px-6 py-5 border-b border-slate-100 flex-row justify-between items-center">
              <Text className="text-lg font-black text-slate-800">{editId ? 'Edit Staff' : 'Add New Staff'}</Text>
              <Pressable onPress={() => setPanelOpen(false)}><Text className="text-2xl text-slate-400">×</Text></Pressable>
            </View>
            <ScrollView contentContainerClassName="px-6 py-5 gap-4">
              {error ? (
                <View className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <Text className="text-rose-600 text-xs font-bold">{error}</Text>
                </View>
              ) : null}
              <Field label="Full Name" value={form.name} onChange={(v) => setField('name', v)} placeholder="e.g. Ashwin Kumar" />
              <Field label="Email Login" value={form.email} onChange={(v) => setField('email', v)} placeholder="user@ebright.my" keyboardType="email-address" />
              <Field label={editId ? 'New Password (blank = keep)' : 'Password'} value={form.password} onChange={(v) => setField('password', v)} placeholder={editId ? 'Leave blank' : 'Ebright2026!'} />
              <View>
                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">System Role</Text>
                <Dropdown value={form.role} options={ROLE_OPTIONS} onChange={(v) => setField('role', v)} />
              </View>
              {form.role === 'USER_BM' && (
                <Field label="Branch Code" value={form.branch} onChange={(v) => setField('branch', v.toUpperCase())} placeholder="e.g. RBY" />
              )}
            </ScrollView>
            <View className="px-6 py-5 border-t border-slate-100 bg-slate-50 flex-row gap-3">
              <Pressable onPress={() => setPanelOpen(false)} className="flex-1 py-3.5 rounded-2xl items-center active:bg-slate-200">
                <Text className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Cancel</Text>
              </Pressable>
              <Pressable onPress={save} className="flex-1 py-3.5 bg-violet-600 rounded-2xl items-center active:scale-95">
                <Text className="text-[11px] font-black text-white uppercase tracking-widest">{editId ? 'Update' : 'Create'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View className="flex-1 bg-white border border-slate-200 rounded-2xl px-4 py-4 shadow-sm">
      <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</Text>
      <Text className={`text-3xl font-black ${color}`}>{value}</Text>
    </View>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; keyboardType?: 'default' | 'email-address' }) {
  return (
    <View>
      <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold"
      />
    </View>
  );
}
