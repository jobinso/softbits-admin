import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Shield, Lock, Trash2, Edit, Unlock, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DataTable,
  Button,
  Modal,
  StatusBadge,
  TableCard,
  TableFilterDropdown,
  TableColumnPicker,
} from '@/components/shared';
import type { ColumnDef, TableFilterField, TableColumnPickerColumn } from '@/components/shared';
import {
  deleteUser,
  disableUser2fa,
  reregisterUser2fa,
  unlockUser,
  updateUser,
} from '@/services/admin-service';
import { useModal } from '@shared/hooks';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserRow {
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

export interface RoleOption {
  id: string;
  name: string;
}

interface UserTableProps {
  users: UserRow[];
  roles: RoleOption[];
  onEdit: (user: UserRow) => void;
  onCreate: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UserTable({ users, roles, onEdit, onCreate }: UserTableProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const twoFAModal = useModal<UserRow>();
  const deleteModal = useModal<UserRow>();
  const passwordModal = useModal<UserRow>();
  const [newPassword, setNewPassword] = useState('');

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

  const filterFields: TableFilterField[] = useMemo(() => [
    { key: 'role', label: 'Role', type: 'select', options: roles.map((r) => ({ value: r.id || r.name, label: r.name })) },
    { key: 'userType', label: 'Type', type: 'select', options: [{ value: 'named', label: 'Named' }, { value: 'concurrent', label: 'Concurrent' }, { value: 'api', label: 'API' }] },
    { key: 'enabled', label: 'Status', type: 'select', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Disabled' }] },
    { key: 'sysproOperator', label: 'ERP Operator', type: 'text' },
  ], [roles]);

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

    const activeFilters = Object.entries(filters).filter(([, v]) => v);
    if (activeFilters.length > 0) {
      result = result.filter((row) =>
        activeFilters.every(([key, value]) => {
          const rowVal = (row as any)[key];
          if (rowVal == null) return false;
          const field = filterFields.find((f) => f.key === key);
          if (field?.type === 'select') return String(rowVal) === value;
          return String(rowVal).toLowerCase().includes(value.toLowerCase());
        })
      );
    }

    return result;
  }, [users, search, filters, filterFields]);

  // ---- Mutations ----

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

  function handlePasswordChange() {
    if (!passwordModal.data) return;
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    passwordMutation.mutate({ userId: passwordModal.data.id, password: newPassword });
  }

  // ---- Column definitions ----

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
            onClick={(e) => { e.stopPropagation(); onEdit(row); }}
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

  return (
    <>
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
            <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={onCreate}>
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
          onRowClick={onEdit}
          emptyMessage="No users found"
          emptyIcon={Users}
          embedded
          showColumnPicker={false}
          showFilters={false}
        />
      </TableCard>

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
    </>
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
