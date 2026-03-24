import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Shield, Trash2, Edit, Lock, Unlock, KeyRound, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DataTable,
  Button,
  Modal,
  StatusBadge,
  LoadingSpinner,
  PageHeader,
  TableCard,
  TableFilterDropdown,
  TableColumnPicker,
} from '@/components/shared';
import type { ColumnDef, TableFilterField, TableColumnPickerColumn } from '@/components/shared';
import {
  getUsers,
  getRoles,
  createUser,
  updateUser,
  deleteUser,
  disableUser2fa,
  reregisterUser2fa,
  unlockUser,
  getErpOperator,
} from '@/services/admin-service';
import { useModal } from '@shared/hooks';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserRow {
  id: string;
  username: string;
  fullName?: string;
  email?: string;
  role: string;
  enabled: boolean;
  totpEnabled: boolean;
  userType?: string;
  sysproOperator?: string;
  createdAt?: string;
  department?: string;
  displayName?: string;
  sysproCompany?: string;
  maxSessions?: number;
  allowedModules?: string[];
  entityPermissions?: Record<string, string[]> | '*';
  mcpPermissions?: string[];
  lockedOut?: boolean;
}

interface RoleOption {
  id: string;
  name: string;
}

interface UserFormData {
  username: string;
  email: string;
  fullName: string;
  password: string;
  role: string;
  enabled: boolean;
  sysproOperator: string;
  displayName: string;
  department: string;
  sysproCompany: string;
  userType: string;
  maxSessions: number;
}

const INITIAL_FORM: UserFormData = {
  username: '',
  email: '',
  fullName: '',
  password: '',
  role: 'viewer',
  enabled: true,
  sysproOperator: '',
  displayName: '',
  department: '',
  sysproCompany: '',
  userType: 'named',
  maxSessions: 1,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const createModal = useModal<UserRow>();
  const twoFAModal = useModal<UserRow>();
  const deleteModal = useModal<UserRow>();
  const passwordModal = useModal<UserRow>();
  const [form, setForm] = useState<UserFormData>(INITIAL_FORM);
  const [newPassword, setNewPassword] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [erpLookupLoading, setErpLookupLoading] = useState(false);
  const [erpDefaults, setErpDefaults] = useState<{ warehouse?: string; arBranch?: string; apBranch?: string; company?: string } | null>(null);

  // ---- Data fetching ----

  const { data: usersResponse, isLoading: usersLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: getUsers,
  });

  const { data: rolesResponse } = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: getRoles,
  });

  const users: UserRow[] = usersResponse?.users ?? [];
  const roles: RoleOption[] = rolesResponse?.roles ?? [];

  // ---- Filters & column visibility ----

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearAllFilters = () => {
    setFilters({});
  };

  const toggleColumnVisibility = (key: string) => {
    setColumnVisibility((prev) => ({ ...prev, [key]: prev[key] === false ? true : false }));
  };

  // Filter fields for the dropdown (only columns that are filterable)
  const filterFields: TableFilterField[] = useMemo(() => [
    { key: 'role', label: 'Role', type: 'select', options: roles.map((r) => ({ value: r.id || r.name, label: r.name })) },
    { key: 'userType', label: 'Type', type: 'select', options: [{ value: 'named', label: 'Named' }, { value: 'concurrent', label: 'Concurrent' }, { value: 'api', label: 'API' }] },
    { key: 'enabled', label: 'Status', type: 'select', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Disabled' }] },
    { key: 'sysproOperator', label: 'ERP Operator', type: 'text' },
  ], [roles]);

  // Columns available for visibility toggling
  const pickerColumns: TableColumnPickerColumn[] = useMemo(() => [
    { key: 'username', label: 'Username' },
    { key: 'role', label: 'Role' },
    { key: 'userType', label: 'Type' },
    { key: 'sysproOperator', label: 'ERP Operator' },
    { key: 'enabled', label: 'Status' },
    { key: 'totpEnabled', label: '2FA' },
  ], []);

  // ---- Filtered data ----

  const filteredUsers = useMemo(() => {
    let result = users;

    // Apply search
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.username.toLowerCase().includes(s) ||
          (u.fullName && u.fullName.toLowerCase().includes(s)) ||
          (u.email && u.email.toLowerCase().includes(s)) ||
          u.role.toLowerCase().includes(s)
      );
    }

    // Apply column filters
    const activeFilters = Object.entries(filters).filter(([, v]) => v);
    if (activeFilters.length > 0) {
      result = result.filter((row) =>
        activeFilters.every(([key, value]) => {
          const rowVal = (row as any)[key];
          if (rowVal == null) return false;
          // Select filters use exact match; text uses contains
          const field = filterFields.find((f) => f.key === key);
          if (field?.type === 'select') return String(rowVal) === value;
          return String(rowVal).toLowerCase().includes(value.toLowerCase());
        })
      );
    }

    return result;
  }, [users, search, filters, filterFields]);

  // ---- Mutations ----

  const createMutation = useMutation({
    mutationFn: (data: Partial<UserRow> & { password?: string }) => createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      createModal.close();
      toast.success('User created successfully');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create user'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: Partial<UserRow> }) =>
      updateUser(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      createModal.close();
      toast.success('User updated successfully');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update user'),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      deleteModal.close();
      toast.success('User deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete user'),
  });

  const disable2faMutation = useMutation({
    mutationFn: (userId: string) => disableUser2fa(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      twoFAModal.close();
      toast.success('2FA disabled');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to disable 2FA'),
  });

  const reregister2faMutation = useMutation({
    mutationFn: (userId: string) => reregisterUser2fa(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      twoFAModal.close();
      toast.success('2FA reset. User will set up 2FA on next login.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to reset 2FA'),
  });

  const unlockMutation = useMutation({
    mutationFn: (userId: string) => unlockUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('User account unlocked');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to unlock user'),
  });

  const passwordMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      updateUser(userId, { password } as Partial<UserRow>),
    onSuccess: () => {
      passwordModal.close();
      setNewPassword('');
      toast.success('Password updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to change password'),
  });

  // ---- Handlers ----

  function openCreate() {
    setForm(INITIAL_FORM);
    setIsEditing(false);
    setEditingUserId(null);
    setErpDefaults(null);
    createModal.open();
  }

  async function handleErpLookup() {
    if (!form.sysproOperator.trim()) {
      toast.error('Enter an ERP Operator code first');
      return;
    }
    setErpLookupLoading(true);
    try {
      const result = await getErpOperator(form.sysproOperator.trim());
      const op = result.data?.operator;
      if (!op) {
        toast.error('Operator not found in ERP');
        return;
      }
      // Auto-fill form fields from ERP data
      setForm((prev) => ({
        ...prev,
        fullName: op.name || op.preferredName || prev.fullName,
        email: op.contact?.email || prev.email,
        displayName: op.preferredName || op.name || prev.displayName,
        department: op.contact?.department || prev.department,
        sysproCompany: op.defaults?.company || prev.sysproCompany,
      }));
      // Store ERP defaults for display
      setErpDefaults({
        warehouse: op.defaults?.warehouse,
        arBranch: op.defaults?.arBranch,
        apBranch: op.defaults?.apBranch,
        company: op.defaults?.company,
      });
      toast.success(`Loaded ERP data for ${op.operatorCode}`);
    } catch {
      toast.error('Failed to lookup ERP operator');
    } finally {
      setErpLookupLoading(false);
    }
  }

  function openEdit(user: UserRow) {
    setForm({
      username: user.username,
      email: user.email || '',
      fullName: user.fullName || '',
      password: '',
      role: user.role,
      enabled: user.enabled,
      sysproOperator: user.sysproOperator || '',
      displayName: user.displayName || '',
      department: user.department || '',
      sysproCompany: user.sysproCompany || '',
      userType: user.userType || 'named',
      maxSessions: user.maxSessions || 1,
    });
    setIsEditing(true);
    setEditingUserId(user.id);
    createModal.open(user);
  }

  function handleSave() {
    if (!form.username.trim()) {
      toast.error('Username is required');
      return;
    }
    if (!isEditing && form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error('Invalid email format');
      return;
    }

    if (isEditing && editingUserId) {
      const { password, ...updates } = form;
      updateMutation.mutate({ userId: editingUserId, data: updates });
    } else {
      createMutation.mutate(form);
    }
  }

  function handlePasswordChange() {
    if (!passwordModal.data) return;
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    passwordMutation.mutate({ userId: passwordModal.data.id, password: newPassword });
  }

  // ---- Column definitions (visibility applied from columnVisibility state) ----

  const columns: ColumnDef<UserRow>[] = [
    {
      key: 'username',
      label: 'Username',
      width: 280,
      minWidth: 240,
      hidden: columnVisibility.username === false,
      sortable: true,
      noTruncate: true,
      render: (_val, row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-primary to-info flex items-center justify-center text-xs font-semibold text-semantic-text-on-primary">
            {(row.fullName || row.username)
              .split(' ')
              .map((n: string) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)}
          </div>
          <div>
            <div className="font-medium text-semantic-text-default">{row.username}</div>
            <div className="text-xs text-semantic-text-faint">
              {row.fullName || 'No name'} &middot; {row.email || 'No email'}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      width: 120,
      sortable: true,
      hidden: columnVisibility.role === false,
      render: (val) => {
        const roleColors: Record<string, 'danger' | 'warning' | 'info' | 'neutral'> = {
          admin: 'danger',
          supervisor: 'warning',
          manager: 'warning',
          viewer: 'info',
        };
        return <StatusBadge status={roleColors[val] || 'neutral'} label={val} size="sm" />;
      },
    },
    {
      key: 'userType',
      label: 'Type',
      width: 100,
      sortable: true,
      hidden: columnVisibility.userType === false,
      render: (val) => (
        <StatusBadge status="neutral" label={val === 'concurrent' ? 'Concurrent' : val === 'api' ? 'API' : 'Named'} size="sm" />
      ),
    },
    {
      key: 'sysproOperator',
      label: 'ERP Operator',
      width: 130,
      sortable: true,
      hidden: columnVisibility.sysproOperator === false,
      render: (val) => (
        <span className="text-xs font-mono text-semantic-text-faint">{val || '-'}</span>
      ),
    },
    {
      key: 'enabled',
      label: 'Status',
      width: 100,
      sortable: true,
      hidden: columnVisibility.enabled === false,
      render: (val: boolean) => (
        <StatusBadge
          status={val ? 'success' : 'danger'}
          label={val ? 'Active' : 'Disabled'}
          size="sm"
        />
      ),
    },
    {
      key: 'totpEnabled',
      label: '2FA',
      width: 100,
      sortable: true,
      hidden: columnVisibility.totpEnabled === false,
      render: (val: boolean) => (
        <StatusBadge
          status={val ? 'success' : 'neutral'}
          label={val ? 'Enabled' : 'Not Set'}
          size="sm"
        />
      ),
    },
    {
      key: 'id',
      label: 'Actions',
      width: 200,
      sortable: false,
      noTruncate: true,
      render: (_val: string, row: UserRow) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); openEdit(row); }}
            className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover transition-colors"
            title="Edit user"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); twoFAModal.open(row); }}
            className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover transition-colors"
            title="Manage 2FA"
          >
            <Shield className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setNewPassword('');
              passwordModal.open(row);
            }}
            className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover transition-colors"
            title="Change password"
          >
            <KeyRound className="w-4 h-4" />
          </button>
          {row.lockedOut && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); unlockMutation.mutate(row.id); }}
              className="p-1.5 text-warning hover:text-warning/80 rounded hover:bg-interactive-hover transition-colors"
              title="Unlock account"
            >
              <Unlock className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); deleteModal.open(row); }}
            className="p-1.5 text-semantic-text-faint hover:text-danger rounded hover:bg-interactive-hover transition-colors"
            title="Delete user"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  // ---- Render ----

  if (usersLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TableCard
        title="All Users"
        icon={<Users className="w-4 h-4" />}
        count={filteredUsers.length}
        search={{ value: search, onChange: setSearch, placeholder: "Search users by name, email, or role..." }}
        headerActions={
          <div className="flex items-center gap-1">
            <TableFilterDropdown
              fields={filterFields}
              values={filters}
              onChange={handleFilterChange}
              onClearAll={handleClearAllFilters}
            />
            <TableColumnPicker
              columns={pickerColumns}
              visibility={columnVisibility}
              onToggle={toggleColumnVisibility}
            />
            <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>
              Create User
            </Button>
          </div>
        }
      >
        <DataTable<UserRow>
          id="admin-users"
          columns={columns}
          data={filteredUsers}
          rowKey="id"
          onRowClick={openEdit}
          emptyMessage="No users found"
          emptyIcon={Users}
          embedded
          showColumnPicker={false}
          showFilters={false}
        />
      </TableCard>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={createModal.isOpen}
        onClose={createModal.close}
        title={isEditing ? 'Edit User' : 'Create User'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={createModal.close}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-user-form"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {isEditing ? 'Save Changes' : 'Create User'}
            </Button>
          </>
        }
      >
        <form id="create-user-form" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Username" required>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                disabled={isEditing}
                className="form-input"
                placeholder="Enter username"
              />
            </FormField>
            <FormField label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="form-input"
                placeholder="user@example.com"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Full Name">
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="form-input"
                placeholder="First Last"
              />
            </FormField>
            <FormField label="Display Name">
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                className="form-input"
                placeholder="Display name"
              />
            </FormField>
          </div>

          {!isEditing && (
            <FormField label="Password" required>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="form-input"
                placeholder="Min 8 characters"
                minLength={8}
              />
            </FormField>
          )}

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Role">
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="form-input"
                title="Role"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
                {roles.length === 0 && (
                  <>
                    <option value="admin">Admin</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="viewer">Viewer</option>
                  </>
                )}
              </select>
            </FormField>
            <FormField label="User Type">
              <select
                value={form.userType}
                onChange={(e) => setForm({ ...form, userType: e.target.value })}
                className="form-input"
                title="User Type"
              >
                <option value="named">Named</option>
                <option value="concurrent">Concurrent</option>
                <option value="api">API</option>
              </select>
            </FormField>
          </div>

          {/* ERP Section */}
          <div className="border-t border-border pt-4 mt-2">
            <h4 className="text-xs font-semibold text-semantic-text-subtle uppercase tracking-wider mb-3">ERP Integration</h4>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="ERP Operator">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.sysproOperator}
                    onChange={(e) => setForm({ ...form, sysproOperator: e.target.value })}
                    className="form-input flex-1"
                    placeholder="SYSPRO operator code"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={<Search className="w-3.5 h-3.5" />}
                    onClick={handleErpLookup}
                    loading={erpLookupLoading}
                    disabled={!form.sysproOperator.trim()}
                  >
                    Lookup
                  </Button>
                </div>
              </FormField>
              <FormField label="ERP Company">
                <input
                  type="text"
                  value={form.sysproCompany}
                  onChange={(e) => setForm({ ...form, sysproCompany: e.target.value })}
                  className="form-input"
                  placeholder="SYSPRO company"
                />
              </FormField>
            </div>

            {/* ERP Defaults (read-only, shown after lookup) */}
            {erpDefaults && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 p-3 bg-surface-raised border border-border rounded-lg">
                <div>
                  <p className="text-[10px] text-semantic-text-faint uppercase tracking-wider">Default Warehouse</p>
                  <p className="text-sm font-medium text-semantic-text-default">{erpDefaults.warehouse || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-semantic-text-faint uppercase tracking-wider">AR Branch</p>
                  <p className="text-sm font-medium text-semantic-text-default">{erpDefaults.arBranch || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-semantic-text-faint uppercase tracking-wider">AP Branch</p>
                  <p className="text-sm font-medium text-semantic-text-default">{erpDefaults.apBranch || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-semantic-text-faint uppercase tracking-wider">Company</p>
                  <p className="text-sm font-medium text-semantic-text-default">{erpDefaults.company || '-'}</p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Department">
              <input
                type="text"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="form-input"
                placeholder="Department"
              />
            </FormField>
            <FormField label="Max Sessions">
              <input
                type="number"
                value={form.maxSessions}
                onChange={(e) => setForm({ ...form, maxSessions: parseInt(e.target.value) || 1 })}
                className="form-input"
                placeholder="1"
                min={1}
                max={10}
              />
            </FormField>
          </div>

          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                className="sr-only peer"
                title="Active status"
              />
              <div className="w-9 h-5 bg-surface-subtle peer-focus:ring-2 peer-focus:ring-interactive-focus-ring rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-semantic-text-faint after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-primary peer-checked:after:bg-semantic-text-on-primary" />
            </label>
            <span className="text-sm text-semantic-text-secondary">Active</span>
          </div>
        </div>
        </form>
      </Modal>

      {/* 2FA Management Modal */}
      <Modal
        isOpen={twoFAModal.isOpen}
        onClose={twoFAModal.close}
        title={`2FA - ${twoFAModal.data?.username || ''}`}
        size="sm"
        footer={
          twoFAModal.data?.totpEnabled ? (
            <>
              <Button
                variant="secondary"
                onClick={() => twoFAModal.data && reregister2faMutation.mutate(twoFAModal.data.id)}
                loading={reregister2faMutation.isPending}
              >
                Re-register
              </Button>
              <Button
                variant="danger"
                onClick={() => twoFAModal.data && disable2faMutation.mutate(twoFAModal.data.id)}
                loading={disable2faMutation.isPending}
              >
                Disable 2FA
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={twoFAModal.close}>
              Close
            </Button>
          )
        }
      >
        <div className="text-center py-4">
          <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${twoFAModal.data?.totpEnabled ? 'bg-success/20' : 'bg-semantic-text-disabled/20'}`}
          >
            {twoFAModal.data?.totpEnabled ? (
              <Shield className="w-8 h-8 text-success" />
            ) : (
              <Lock className="w-8 h-8 text-semantic-text-faint" />
            )}
          </div>
          <h3 className="text-semantic-text-default font-medium mb-2">
            {twoFAModal.data?.totpEnabled ? '2FA Enabled' : '2FA Not Configured'}
          </h3>
          <p className="text-sm text-semantic-text-faint">
            {twoFAModal.data?.totpEnabled
              ? `Two-factor authentication is active for ${twoFAModal.data.username}.`
              : `User ${twoFAModal.data?.username || ''} will be prompted to set up 2FA on next login.`}
          </p>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.close}
        title="Delete User"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={deleteModal.close}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteModal.data && deleteMutation.mutate(deleteModal.data.id)}
              loading={deleteMutation.isPending}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-semantic-text-subtle">
          Are you sure you want to delete user{' '}
          <strong className="text-semantic-text-default">{deleteModal.data?.username}</strong>? This action cannot
          be undone.
        </p>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        isOpen={passwordModal.isOpen}
        onClose={() => {
          passwordModal.close();
          setNewPassword('');
        }}
        title={`Change Password - ${passwordModal.data?.username || ''}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { passwordModal.close(); setNewPassword(''); }}>
              Cancel
            </Button>
            <Button type="submit" form="change-password-form" loading={passwordMutation.isPending}>
              Update Password
            </Button>
          </>
        }
      >
        <form id="change-password-form" onSubmit={(e) => { e.preventDefault(); handlePasswordChange(); }}>
          <FormField label="New Password" required>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="form-input"
              placeholder="Min 8 characters"
              minLength={8}
            />
          </FormField>
        </form>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FormField (local helper)
// ---------------------------------------------------------------------------

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-semantic-text-subtle mb-1">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
