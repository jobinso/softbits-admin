import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  Modal,
} from '@/components/shared';
import {
  createUser,
  updateUser,
  getErpOperator,
} from '@/services/admin-service';
import type { UserRow, RoleOption } from './user-table';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserRow | null;
  roles: RoleOption[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UserFormModal({ isOpen, onClose, user, roles }: UserFormModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!user;

  const [form, setForm] = useState<UserFormData>(() => {
    if (user) {
      return {
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
      };
    }
    return INITIAL_FORM;
  });

  const [erpLookupLoading, setErpLookupLoading] = useState(false);
  const [erpDefaults, setErpDefaults] = useState<{ warehouse?: string; arBranch?: string; apBranch?: string; company?: string } | null>(null);

  // Reset form when modal opens with new data
  // (Using key prop on the component from parent is preferred, but we also handle here)

  const createMutation = useMutation({
    mutationFn: (data: Partial<UserRow> & { password?: string }) => createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      onClose();
      toast.success('User created successfully');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create user'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: Partial<UserRow> }) =>
      updateUser(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      onClose();
      toast.success('User updated successfully');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update user'),
  });

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
      setForm((prev) => ({
        ...prev,
        fullName: op.name || op.preferredName || prev.fullName,
        email: op.contact?.email || prev.email,
        displayName: op.preferredName || op.name || prev.displayName,
        department: op.contact?.department || prev.department,
        sysproCompany: op.defaults?.company || prev.sysproCompany,
      }));
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

    if (isEditing && user) {
      const { password, ...updates } = form;
      updateMutation.mutate({ userId: user.id, data: updates });
    } else {
      createMutation.mutate(form);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit User' : 'Create User'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
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
