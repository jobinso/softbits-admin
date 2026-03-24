import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Plus, Edit, Trash2, ChevronDown, ChevronRight, Search, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DataTable,
  Button,
  Modal,
  StatusBadge,
  LoadingSpinner,
  PageHeader,
  TableCard,
} from '@/components/shared';
import type { ColumnDef } from '@/components/shared';
import {
  getSystemSettings,
  updateSystemSetting,
  createSystemSetting,
  deleteSystemSetting,
} from '@/services/admin-service';
import { useModal } from '@shared/hooks';
import type { SystemSetting } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Map setting key prefixes to user-friendly display names */
const CATEGORY_LABELS: Record<string, string> = {
  pos: 'POS / Point of Sale',
  inventory: 'Inventory',
  system: 'System',
  audit: 'Audit Logging',
  presentation: 'Presentation',
};

/** Categories with dedicated admin UI — show as read-only */
const MANAGED_CATEGORIES = new Set(['audit']);

interface SettingForm {
  key: string;
  value: string;
  description: string;
  dataType: 'string' | 'number' | 'boolean' | 'json';
}

const INITIAL_FORM: SettingForm = { key: '', value: '', description: '', dataType: 'string' };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the category prefix from a setting key (everything before the first dot) */
function getCategory(key: string): string {
  const idx = key.indexOf('.');
  return idx > 0 ? key.substring(0, idx) : 'other';
}

/** Get the key portion after the category prefix */
function getSubKey(key: string): string {
  const idx = key.indexOf('.');
  return idx > 0 ? key.substring(idx + 1) : key;
}

/** Get a friendly label for a category */
function getCategoryLabel(prefix: string): string {
  return CATEGORY_LABELS[prefix] || prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

/** Format a setting value for display */
function formatDisplayValue(value: string | null, dataType: string): string {
  if (value === null || value === undefined) return '-';
  if (dataType === 'boolean') return value.toLowerCase() === 'true' ? 'Yes' : 'No';
  if (dataType === 'json') {
    try {
      return JSON.stringify(JSON.parse(value), null, 0).substring(0, 80) + (value.length > 80 ? '...' : '');
    } catch {
      return value.substring(0, 80);
    }
  }
  if (value.length > 80) return value.substring(0, 80) + '...';
  return value;
}

/** Format relative time */
function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SystemSettingsPage() {
  const queryClient = useQueryClient();
  const editModal = useModal<SystemSetting>();
  const createModal = useModal();
  const deleteModal = useModal<SystemSetting>();
  const [editForm, setEditForm] = useState<SettingForm>(INITIAL_FORM);
  const [createForm, setCreateForm] = useState<SettingForm>(INITIAL_FORM);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // ---- Data fetching ----

  const { data: settingsResponse, isLoading } = useQuery({
    queryKey: ['admin', 'system-settings'],
    queryFn: getSystemSettings,
  });

  const allSettings: SystemSetting[] = settingsResponse?.data ?? [];

  // ---- Group settings by category ----

  const groupedSettings = useMemo(() => {
    const filtered = searchQuery
      ? allSettings.filter((s) => {
          const q = searchQuery.toLowerCase();
          return (
            s.SettingKey.toLowerCase().includes(q) ||
            (s.SettingValue || '').toLowerCase().includes(q) ||
            (s.Description || '').toLowerCase().includes(q)
          );
        })
      : allSettings;

    const groups: Record<string, SystemSetting[]> = {};
    for (const setting of filtered) {
      const cat = getCategory(setting.SettingKey);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(setting);
    }

    // Sort categories: known ones first in order, then alphabetical
    const knownOrder = Object.keys(CATEGORY_LABELS);
    return Object.entries(groups).sort(([a], [b]) => {
      const aIdx = knownOrder.indexOf(a);
      const bIdx = knownOrder.indexOf(b);
      if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
      if (aIdx >= 0) return -1;
      if (bIdx >= 0) return 1;
      return a.localeCompare(b);
    });
  }, [allSettings, searchQuery]);

  // ---- Mutations ----

  const updateMutation = useMutation({
    mutationFn: ({ key, data }: { key: string; data: { value: string; description?: string } }) =>
      updateSystemSetting(key, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'system-settings'] });
      editModal.close();
      toast.success('Setting updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update setting'),
  });

  const createMutation = useMutation({
    mutationFn: (data: { key: string; value: string; description?: string; dataType?: string }) =>
      createSystemSetting(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'system-settings'] });
      createModal.close();
      toast.success('Setting created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create setting'),
  });

  const deleteMutation = useMutation({
    mutationFn: (key: string) => deleteSystemSetting(key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'system-settings'] });
      deleteModal.close();
      toast.success('Setting deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete setting'),
  });

  // ---- Handlers ----

  function openEdit(setting: SystemSetting) {
    if (MANAGED_CATEGORIES.has(getCategory(setting.SettingKey))) return;
    setEditForm({
      key: setting.SettingKey,
      value: setting.SettingValue || '',
      description: setting.Description || '',
      dataType: setting.DataType || 'string',
    });
    editModal.open(setting);
  }

  function handleSaveEdit() {
    if (editForm.value === undefined) {
      toast.error('Value is required');
      return;
    }
    updateMutation.mutate({
      key: editForm.key,
      data: { value: editForm.value, description: editForm.description },
    });
  }

  function openCreate() {
    setCreateForm(INITIAL_FORM);
    createModal.open();
  }

  function handleSaveCreate() {
    if (!createForm.key.trim()) {
      toast.error('Key is required');
      return;
    }
    if (createForm.dataType === 'json') {
      try {
        JSON.parse(createForm.value);
      } catch {
        toast.error('Invalid JSON value');
        return;
      }
    }
    createMutation.mutate({
      key: createForm.key,
      value: createForm.value,
      description: createForm.description,
      dataType: createForm.dataType,
    });
  }

  function toggleCategory(cat: string) {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }

  // ---- Column definitions ----

  function getColumns(category: string): ColumnDef<SystemSetting>[] {
    const isManaged = MANAGED_CATEGORIES.has(category);

    return [
      {
        key: 'SettingKey',
        label: 'Key',
        width: 250,
        sortable: true,
        render: (val: string) => (
          <code className="text-xs bg-info/10 text-info px-1.5 py-0.5 rounded font-semibold">
            {getSubKey(val)}
          </code>
        ),
      },
      {
        key: 'SettingValue',
        label: 'Value',
        sortable: false,
        render: (val: string | null, row: SystemSetting) => {
          if (row.DataType === 'boolean') {
            const isTrue = (val || '').toLowerCase() === 'true';
            return <StatusBadge status={isTrue ? 'success' : 'neutral'} label={isTrue ? 'Yes' : 'No'} size="sm" />;
          }
          return (
            <span className="text-sm text-semantic-text-default font-mono truncate max-w-[200px] inline-block" title={val || ''}>
              {formatDisplayValue(val, row.DataType)}
            </span>
          );
        },
      },
      {
        key: 'DataType',
        label: 'Type',
        width: 80,
        sortable: true,
        render: (val: string) => {
          const statusMap: Record<string, 'info' | 'success' | 'warning' | 'neutral'> = {
            string: 'info',
            number: 'success',
            boolean: 'warning',
            json: 'neutral',
          };
          return <StatusBadge status={statusMap[val] || 'neutral'} label={val} size="sm" />;
        },
      },
      {
        key: 'Description',
        label: 'Description',
        sortable: false,
        render: (val: string | null) => (
          <span className="text-xs text-semantic-text-faint truncate max-w-[250px] inline-block" title={val || ''}>
            {val || '-'}
          </span>
        ),
      },
      {
        key: 'UpdatedAt',
        label: 'Updated',
        width: 120,
        sortable: true,
        render: (val: string | null, row: SystemSetting) => (
          <span className="text-xs text-semantic-text-faint" title={row.UpdatedBy ? `by ${row.UpdatedBy}` : ''}>
            {formatRelativeTime(val)}
          </span>
        ),
      },
      {
        key: 'SettingKey' as keyof SystemSetting,
        label: 'Actions',
        width: 100,
        sortable: false,
        render: (_val: string, row: SystemSetting) => {
          if (isManaged) {
            return (
              <span className="text-xs text-semantic-text-faint italic" title="Managed via dedicated settings page">
                <Info className="w-3.5 h-3.5 inline mr-1" />Read-only
              </span>
            );
          }
          return (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => openEdit(row)}
                className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover transition-colors"
                title="Edit"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => deleteModal.open(row)}
                className="p-1.5 text-semantic-text-faint hover:text-danger rounded hover:bg-interactive-hover transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        },
      },
    ];
  }

  // ---- Render ----

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        description="View and manage system-wide configuration settings"
      />

      {/* Search and actions bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-semantic-text-faint" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search settings..."
            className="form-input pl-9"
          />
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>
          Add Setting
        </Button>
      </div>

      {/* Category groups */}
      {groupedSettings.length === 0 && (
        <div className="text-center py-12 text-semantic-text-faint">
          {searchQuery ? 'No settings match your search' : 'No system settings found'}
        </div>
      )}

      {groupedSettings.map(([category, settings]) => {
        const isCollapsed = collapsedCategories[category];
        const isManaged = MANAGED_CATEGORIES.has(category);

        return (
          <div key={category}>
            <button
              type="button"
              onClick={() => toggleCategory(category)}
              className="flex items-center gap-2 w-full text-left mb-2 group"
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4 text-semantic-text-faint group-hover:text-semantic-text-secondary transition-colors" />
              ) : (
                <ChevronDown className="w-4 h-4 text-semantic-text-faint group-hover:text-semantic-text-secondary transition-colors" />
              )}
              <span className="text-sm font-medium text-semantic-text-secondary group-hover:text-semantic-text-default transition-colors">
                {getCategoryLabel(category)}
              </span>
              <span className="text-xs text-semantic-text-faint">({settings.length})</span>
              {isManaged && (
                <span className="text-xs text-semantic-text-faint italic ml-2">
                  Managed via dedicated settings page
                </span>
              )}
            </button>

            {!isCollapsed && (
              <TableCard
                title={getCategoryLabel(category)}
                icon={<Settings className="w-4 h-4" />}
                count={settings.length}
              >
                <DataTable<SystemSetting>
                  id={`system-settings-${category}`}
                  columns={getColumns(category)}
                  data={settings}
                  rowKey="SettingKey"
                  onRowClick={isManaged ? undefined : openEdit}
                  emptyMessage="No settings in this category"
                  emptyIcon={Settings}
                  embedded
                  showColumnPicker={false}
                />
              </TableCard>
            )}
          </div>
        );
      })}

      {/* Edit Setting Modal */}
      <Modal
        isOpen={editModal.isOpen}
        onClose={editModal.close}
        title="Edit Setting"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={editModal.close}>Cancel</Button>
            <Button onClick={handleSaveEdit} loading={updateMutation.isPending}>
              Save Changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Key">
            <input
              type="text"
              value={editForm.key}
              className="form-input bg-surface-subtle text-semantic-text-faint"
              disabled
            />
          </FormField>

          <FormField label="Value" required>
            {editForm.dataType === 'boolean' ? (
              <div className="flex items-center gap-3 py-1">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.value.toLowerCase() === 'true'}
                    onChange={(e) => setEditForm({ ...editForm, value: String(e.target.checked) })}
                    className="sr-only peer"
                    title="Value"
                  />
                  <div className="w-9 h-5 bg-surface-subtle peer-focus:ring-2 peer-focus:ring-interactive-focus-ring rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-semantic-text-faint after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-primary peer-checked:after:bg-semantic-text-on-primary" />
                </label>
                <span className="text-sm text-semantic-text-secondary">
                  {editForm.value.toLowerCase() === 'true' ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            ) : editForm.dataType === 'json' ? (
              <textarea
                value={editForm.value}
                onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                className="form-input font-mono text-xs min-h-[120px]"
                placeholder='{"key": "value"}'
              />
            ) : editForm.dataType === 'number' ? (
              <input
                type="number"
                value={editForm.value}
                onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                className="form-input"
                step="any"
              />
            ) : (
              <input
                type="text"
                value={editForm.value}
                onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                className="form-input"
              />
            )}
          </FormField>

          <FormField label="Description">
            <input
              type="text"
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              className="form-input"
              placeholder="Brief description of this setting"
            />
          </FormField>

          <div className="flex items-center gap-2 text-xs text-semantic-text-faint">
            <StatusBadge
              status={
                { string: 'info', number: 'success', boolean: 'warning', json: 'neutral' }[editForm.dataType] as 'info' | 'success' | 'warning' | 'neutral'
              }
              label={editForm.dataType}
              size="sm"
            />
            {editModal.data?.UpdatedBy && (
              <span>Last updated by {editModal.data.UpdatedBy}</span>
            )}
          </div>
        </div>
      </Modal>

      {/* Create Setting Modal */}
      <Modal
        isOpen={createModal.isOpen}
        onClose={createModal.close}
        title="Add Setting"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={createModal.close}>Cancel</Button>
            <Button onClick={handleSaveCreate} loading={createMutation.isPending}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Key" required>
            <input
              type="text"
              value={createForm.key}
              onChange={(e) => setCreateForm({ ...createForm, key: e.target.value })}
              className="form-input"
              placeholder="category.setting.name"
            />
            <p className="text-xs text-semantic-text-faint mt-1">
              Use dot notation for categories (e.g., pos.receipt.footerText)
            </p>
          </FormField>

          <FormField label="Data Type">
            <select
              value={createForm.dataType}
              onChange={(e) => setCreateForm({ ...createForm, dataType: e.target.value as SettingForm['dataType'] })}
              className="form-input"
              title="Data type"
            >
              <option value="string">String</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
              <option value="json">JSON</option>
            </select>
          </FormField>

          <FormField label="Value" required>
            {createForm.dataType === 'boolean' ? (
              <div className="flex items-center gap-3 py-1">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createForm.value === 'true'}
                    onChange={(e) => setCreateForm({ ...createForm, value: String(e.target.checked) })}
                    className="sr-only peer"
                    title="Value"
                  />
                  <div className="w-9 h-5 bg-surface-subtle peer-focus:ring-2 peer-focus:ring-interactive-focus-ring rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-semantic-text-faint after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-primary peer-checked:after:bg-semantic-text-on-primary" />
                </label>
                <span className="text-sm text-semantic-text-secondary">
                  {createForm.value === 'true' ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            ) : createForm.dataType === 'json' ? (
              <textarea
                value={createForm.value}
                onChange={(e) => setCreateForm({ ...createForm, value: e.target.value })}
                className="form-input font-mono text-xs min-h-[120px]"
                placeholder='{"key": "value"}'
              />
            ) : createForm.dataType === 'number' ? (
              <input
                type="number"
                value={createForm.value}
                onChange={(e) => setCreateForm({ ...createForm, value: e.target.value })}
                className="form-input"
                step="any"
              />
            ) : (
              <input
                type="text"
                value={createForm.value}
                onChange={(e) => setCreateForm({ ...createForm, value: e.target.value })}
                className="form-input"
              />
            )}
          </FormField>

          <FormField label="Description">
            <input
              type="text"
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              className="form-input"
              placeholder="Brief description of this setting"
            />
          </FormField>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.close}
        title="Delete Setting"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={deleteModal.close}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => deleteModal.data && deleteMutation.mutate(deleteModal.data.SettingKey)}
              loading={deleteMutation.isPending}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-semantic-text-subtle">
          Are you sure you want to delete{' '}
          <strong className="text-semantic-text-default font-mono">{deleteModal.data?.SettingKey}</strong>?
        </p>
        {deleteModal.data?.Description && (
          <p className="text-xs text-semantic-text-faint mt-2">{deleteModal.data.Description}</p>
        )}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local helper component
// ---------------------------------------------------------------------------

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
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
