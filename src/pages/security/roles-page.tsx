import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Plus, Trash2, Pencil } from 'lucide-react';
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
  getRoles,
  createRole,
  updateRole,
  deleteRole,
} from '@/services/admin-service';
import { useModal } from '@shared/hooks';

// ---------------------------------------------------------------------------
// Constants (mirrored from admin-security.js)
// ---------------------------------------------------------------------------

const AVAILABLE_TABS: Array<{ id: string; name: string; category: string }> = [
  { id: 'bridgedashboard', name: 'Bridge Dashboard', category: 'Bridge' },
  { id: 'security', name: 'Security', category: 'Bridge' },
  { id: 'services', name: 'Services', category: 'Bridge' },
  { id: 'cache', name: 'Cache', category: 'Bridge' },
  { id: 'config', name: 'Config', category: 'Bridge' },
  { id: 'licensing', name: 'Licensing', category: 'Bridge' },
  { id: 'patches', name: 'Updates', category: 'Bridge' },
  { id: 'providers', name: 'Providers', category: 'Bridge' },
  { id: 'labelit', name: 'LabelIT', category: 'Applications' },
  { id: 'stackit', name: 'StackIT', category: 'Applications' },
  { id: 'workit', name: 'InfuseIT - Work', category: 'Applications' },
  { id: 'connectit', name: 'ConnectIT', category: 'Applications' },
  { id: 'flipit', name: 'FlipIT', category: 'Applications' },
  { id: 'floorit', name: 'FloorIT', category: 'Applications' },
  { id: 'infuseit', name: 'InfuseIT - MCP', category: 'Applications' },
  { id: 'shopit', name: 'ShopIT', category: 'Applications' },
  { id: 'pulpit', name: 'PulpIT', category: 'Applications' },
  { id: 'edit', name: 'EdIT', category: 'Applications' },
  { id: 'email-poller', name: 'PollIT', category: 'Applications' },
];

const ENTITY_PERM_ENTITIES: Array<{ id: string; label: string }> = [
  { id: 'customer', label: 'Customer' },
  { id: 'supplier', label: 'Supplier' },
  { id: 'sales_order', label: 'Sales Order' },
  { id: 'purchase_order', label: 'Purchase Order' },
  { id: 'requisition', label: 'Requisition' },
  { id: 'dispatch', label: 'Dispatch' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'bom', label: 'Bill of Materials' },
  { id: 'wip_job', label: 'WIP Job' },
  { id: 'mrp', label: 'MRP' },
  { id: 'gl_history', label: 'GL History' },
  { id: 'cash_book', label: 'Cash Book' },
  { id: 'contact', label: 'Contact' },
  { id: 'lot', label: 'Lot' },
  { id: 'serial', label: 'Serial' },
];

const ENTITY_PERM_ACTIONS = ['get', 'browse', 'post', 'build'] as const;

const CATEGORY_COLORS: Record<string, string> = {
  Bridge: 'text-primary',
  Applications: 'text-purple-400',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RoleRow {
  id: string;
  name: string;
  description?: string;
  tabs?: string[];
  permissions?: Record<string, string[]>;
  isSystem?: boolean;
}

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RolesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const editModal = useModal<RoleRow>();
  const deleteModal = useModal<RoleRow>();
  const [form, setForm] = useState<RoleFormData>(INITIAL_FORM);
  const [isEditing, setIsEditing] = useState(false);

  // ---- Filters & column visibility ----

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };
  const handleClearAllFilters = () => setFilters({});
  const toggleColumnVisibility = (key: string) => {
    setColumnVisibility((prev) => ({ ...prev, [key]: prev[key] === false ? true : false }));
  };

  const filterFields: TableFilterField[] = useMemo(() => [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'description', label: 'Description', type: 'text' },
  ], []);

  const pickerColumns: TableColumnPickerColumn[] = useMemo(() => [
    { key: 'name', label: 'Role Name' },
    { key: 'description', label: 'Description' },
    { key: 'tabs', label: 'Allowed Tabs' },
    { key: 'permissions', label: 'Entities' },
  ], []);

  // ---- Data fetching ----

  const { data: rolesResponse, isLoading } = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: getRoles,
  });

  const roles: RoleRow[] = rolesResponse?.roles ?? [];

  // ---- Filtered data ----

  const filteredRoles = useMemo(() => {
    let result = roles;

    // Apply search
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          r.id.toLowerCase().includes(s) ||
          (r.description && r.description.toLowerCase().includes(s))
      );
    }

    // Apply column filters
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
  }, [roles, search, filters, filterFields]);

  // ---- Mutations ----

  const createMutation = useMutation({
    mutationFn: (data: Partial<RoleRow>) => createRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      editModal.close();
      toast.success('Role created successfully');
    },
    onError: (err: any) => {
      const message = err.response?.data?.error || err.message || 'Failed to create role';
      toast.error(message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ roleId, data }: { roleId: string; data: Partial<RoleRow> }) =>
      updateRole(roleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      editModal.close();
      toast.success('Role updated successfully');
    },
    onError: (err: any) => {
      const message = err.response?.data?.error || err.message || 'Failed to update role';
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (roleId: string) => deleteRole(roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      deleteModal.close();
      toast.success('Role deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete role'),
  });

  // ---- Handlers ----

  function openCreate() {
    setForm(INITIAL_FORM);
    setIsEditing(false);
    editModal.open();
  }

  function openEdit(role: RoleRow) {
    setForm({
      id: role.id,
      name: role.name,
      description: role.description || '',
      tabs: role.tabs || [],
      permissions: role.permissions || {},
    });
    setIsEditing(true);
    editModal.open(role);
  }

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

  // ---- Column definitions ----

  const columns: ColumnDef<RoleRow>[] = [
    {
      key: 'name',
      label: 'Role Name',
      width: 180,
      sortable: true,
      hidden: columnVisibility.name === false,
      render: (_val, row) => (
        <div>
          <div className="font-medium text-semantic-text-default">{row.name}</div>
          <div className="text-xs text-semantic-text-faint font-mono">{row.id}</div>
        </div>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      width: 250,
      sortable: true,
      hidden: columnVisibility.description === false,
      render: (val) => (
        <span className="text-sm text-semantic-text-subtle">{val || '-'}</span>
      ),
    },
    {
      key: 'tabs',
      label: 'Allowed Tabs',
      width: 120,
      sortable: false,
      hidden: columnVisibility.tabs === false,
      render: (val) => {
        const count = Array.isArray(val) ? val.length : 0;
        return (
          <StatusBadge
            status={count > 0 ? 'info' : 'neutral'}
            label={`${count} tab${count !== 1 ? 's' : ''}`}
            size="sm"
          />
        );
      },
    },
    {
      key: 'permissions',
      label: 'Entities',
      width: 120,
      sortable: false,
      hidden: columnVisibility.permissions === false,
      render: (val) => {
        const count = val && typeof val === 'object' ? Object.keys(val).length : 0;
        return (
          <StatusBadge
            status={count > 0 ? 'info' : 'neutral'}
            label={`${count} entit${count !== 1 ? 'ies' : 'y'}`}
            size="sm"
          />
        );
      },
    },
    {
      key: 'isSystem',
      label: 'Type',
      width: 100,
      sortable: true,
      render: (val) => (
        <StatusBadge
          status={val ? 'warning' : 'neutral'}
          label={val ? 'System' : 'Custom'}
          size="sm"
        />
      ),
    },
    {
      key: 'id',
      label: 'Actions',
      width: 100,
      noTruncate: true,
      sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); openEdit(row); }}
            className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover transition-colors"
            title="Edit role"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); deleteModal.open(row); }}
            disabled={row.isSystem}
            className="p-1.5 text-semantic-text-faint hover:text-danger rounded hover:bg-interactive-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={row.isSystem ? 'Cannot delete system role' : 'Delete role'}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  // ---- Render ----

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TableCard
        title="All Roles"
        icon={<ShieldCheck className="w-4 h-4" />}
        count={filteredRoles.length}
        search={{ value: search, onChange: setSearch, placeholder: "Search roles..." }}
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
              Create Role
            </Button>
          </div>
        }
      >
        <DataTable<RoleRow>
          id="admin-roles"
          columns={columns}
          data={filteredRoles}
          rowKey="id"
          onRowClick={openEdit}
          emptyMessage="No roles found"
          emptyIcon={ShieldCheck}
          embedded
          showColumnPicker={false}
          showFilters={false}
        />
      </TableCard>

      {/* Create/Edit Role Modal */}
      <Modal
        isOpen={editModal.isOpen}
        onClose={editModal.close}
        title={isEditing ? 'Edit Role' : 'Create Role'}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={editModal.close}>
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

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.close}
        title="Delete Role"
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
          Are you sure you want to delete role{' '}
          <strong className="text-semantic-text-default">{deleteModal.data?.name}</strong>? Users assigned to this
          role will need to be reassigned.
        </p>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AllowedTabsGrid
// ---------------------------------------------------------------------------

function AllowedTabsGrid({
  selectedTabs,
  onToggle,
}: {
  selectedTabs: string[];
  onToggle: (tabId: string) => void;
}) {
  const grouped = useMemo(() => {
    const map: Record<string, typeof AVAILABLE_TABS> = {};
    for (const tab of AVAILABLE_TABS) {
      if (!map[tab.category]) map[tab.category] = [];
      map[tab.category].push(tab);
    }
    return map;
  }, []);

  return (
    <div className="grid grid-cols-2 gap-6">
      {Object.entries(grouped).map(([category, tabs]) => (
        <div key={category}>
          <div className="flex items-center gap-2 mb-2 pb-1 border-b border-border">
            <div className={`w-2.5 h-2.5 rounded-full ${category === 'Bridge' ? 'bg-primary' : 'bg-purple-400'}`} />
            <span className={`text-xs font-semibold uppercase tracking-wide ${CATEGORY_COLORS[category] || 'text-semantic-text-faint'}`}>
              {category}
            </span>
          </div>
          <div className="space-y-1.5 pl-4">
            {tabs.map((tab) => (
              <label
                key={tab.id}
                className="flex items-center justify-between px-3 py-1.5 rounded-md bg-surface-overlay/40 hover:bg-interactive-hover cursor-pointer transition-colors"
              >
                <span className="text-sm text-semantic-text-secondary">{tab.name}</span>
                <input
                  type="checkbox"
                  checked={selectedTabs.includes(tab.id)}
                  onChange={() => onToggle(tab.id)}
                  className="rounded border-border bg-surface-subtle text-primary focus:ring-interactive-focus-ring"
                />
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PermissionMatrix
// ---------------------------------------------------------------------------

interface PermissionMatrixProps {
  permissions: Record<string, string[]>;
  onChange: (permissions: Record<string, string[]>) => void;
}

function PermissionMatrix({ permissions, onChange }: PermissionMatrixProps) {
  // Derive wildcard from actual permissions data — true when all entities have all actions
  const wildcard = useMemo(() => {
    if (Object.keys(permissions).length === 0) return false;
    return ENTITY_PERM_ENTITIES.every(entity => {
      const perms = permissions[entity.id];
      return perms && ENTITY_PERM_ACTIONS.every(action => perms.includes(action));
    });
  }, [permissions]);

  const toggleWildcard = useCallback(
    (checked: boolean) => {
      if (checked) {
        // Select all permissions
        const allPerms: Record<string, string[]> = {};
        for (const entity of ENTITY_PERM_ENTITIES) {
          allPerms[entity.id] = [...ENTITY_PERM_ACTIONS];
        }
        onChange(allPerms);
      } else {
        onChange({});
      }
    },
    [onChange]
  );

  const togglePermission = useCallback(
    (entityId: string, action: string) => {
      const current = permissions[entityId] || [];
      let next: string[];
      if (current.includes(action)) {
        next = current.filter((a) => a !== action);
      } else {
        next = [...current, action];
      }

      const updated = { ...permissions };
      if (next.length > 0) {
        updated[entityId] = next;
      } else {
        delete updated[entityId];
      }
      onChange(updated);
    },
    [permissions, onChange]
  );

  return (
    <div>
      {/* Wildcard toggle */}
      <label className="flex items-center gap-2 mb-3 text-sm text-semantic-text-subtle cursor-pointer">
        <input
          type="checkbox"
          checked={wildcard}
          onChange={(e) => toggleWildcard(e.target.checked)}
          className="rounded border-border bg-surface-subtle text-primary focus:ring-interactive-focus-ring"
        />
        Select All (grant full access to all entities)
      </label>

      {/* Matrix table */}
      {!wildcard && (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-overlay">
                <th className="text-left px-3 py-2 text-xs font-medium text-semantic-text-faint uppercase tracking-wider">
                  Entity
                </th>
                {ENTITY_PERM_ACTIONS.map((action) => (
                  <th
                    key={action}
                    className="text-center px-2 py-2 text-xs font-medium text-semantic-text-faint uppercase tracking-wider w-20"
                  >
                    {action}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ENTITY_PERM_ENTITIES.map((entity, idx) => {
                const allowed = permissions[entity.id] || [];
                return (
                  <tr
                    key={entity.id}
                    className={idx % 2 === 0 ? 'bg-surface-raised' : 'bg-surface-raised/50'}
                  >
                    <td className="px-3 py-2 text-semantic-text-secondary">{entity.label}</td>
                    {ENTITY_PERM_ACTIONS.map((action) => (
                      <td key={action} className="text-center px-2 py-2">
                        <input
                          type="checkbox"
                          checked={allowed.includes(action)}
                          onChange={() => togglePermission(entity.id, action)}
                          className="rounded border-border bg-surface-subtle text-primary focus:ring-interactive-focus-ring cursor-pointer"
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
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
