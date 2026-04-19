import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Button,
  Modal,
} from '@/components/shared';
import { createRole, updateRole } from '@/services/admin-service';
import { AllowedTabsGrid, PermissionMatrix } from './role-permissions-editor';
import type { RoleRow } from './role-table';
import type { ApiError } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RoleFormData {
  id: string;
  name: string;
  description: string;
  tabs: string[];
  permissions: Record<string, string[]>;
}

const INITIAL_FORM: RoleFormData = {
  id: '',
  name: '',
  description: '',
  tabs: [],
  permissions: {},
};

interface RoleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: RoleRow | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RoleFormModal({ isOpen, onClose, role }: RoleFormModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!role;

  const [form, setForm] = useState<RoleFormData>(() => {
    if (role) {
      return {
        id: role.id,
        name: role.name,
        description: role.description || '',
        tabs: role.tabs || [],
        permissions: role.permissions || {},
      };
    }
    return INITIAL_FORM;
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<RoleRow>) => createRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      onClose();
      toast.success('Role created successfully');
    },
    onError: (err: ApiError) => {
      const message = err.response?.data?.error || err.message || 'Failed to create role';
      toast.error(message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ roleId, data }: { roleId: string; data: Partial<RoleRow> }) =>
      updateRole(roleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      onClose();
      toast.success('Role updated successfully');
    },
    onError: (err: ApiError) => {
      const message = err.response?.data?.error || err.message || 'Failed to update role';
      toast.error(message);
    },
  });

  function handleSave() {
    if (!form.id.trim()) {
      toast.error('Role ID is required');
      return;
    }
    if (!isEditing && !/^[a-z][a-z0-9_-]{2,19}$/.test(form.id)) {
      toast.error('Role ID must be 3-20 characters, start with a lowercase letter, and contain only lowercase letters, numbers, underscores, and hyphens');
      return;
    }
    if (!form.name.trim()) {
      toast.error('Role name is required');
      return;
    }

    const payload = {
      id: form.id,
      name: form.name,
      description: form.description,
      tabs: form.tabs,
      permissions: form.permissions,
    };

    if (isEditing) {
      updateMutation.mutate({ roleId: form.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const toggleTab = useCallback(
    (tabId: string) => {
      setForm((prev) => ({
        ...prev,
        tabs: prev.tabs.includes(tabId)
          ? prev.tabs.filter((t) => t !== tabId)
          : [...prev.tabs, tabId],
      }));
    },
    []
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Role' : 'Create Role'}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            loading={createMutation.isPending || updateMutation.isPending}
          >
            {isEditing ? 'Save Changes' : 'Create Role'}
          </Button>
        </>
      }
    >
      <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
        {/* Basic fields */}
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Role ID" required>
            <input
              type="text"
              value={form.id}
              onChange={(e) => setForm({ ...form, id: e.target.value })}
              disabled={isEditing}
              className="form-input"
              placeholder="e.g. supervisor"
            />
          </FormField>
          <FormField label="Role Name" required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="form-input"
              placeholder="e.g. Supervisor"
            />
          </FormField>
        </div>

        <FormField label="Description">
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="form-input"
            placeholder="Brief description of this role"
          />
        </FormField>

        {/* Allowed Tabs */}
        <div>
          <h3 className="text-sm font-medium text-semantic-text-secondary mb-3">Allowed Tabs</h3>
          <AllowedTabsGrid selectedTabs={form.tabs} onToggle={toggleTab} />
        </div>

        {/* Entity Permissions Matrix */}
        <div>
          <h3 className="text-sm font-medium text-semantic-text-secondary mb-3">Entity Permissions</h3>
          <PermissionMatrix
            permissions={form.permissions}
            onChange={(permissions) => setForm({ ...form, permissions })}
          />
        </div>
      </div>
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
