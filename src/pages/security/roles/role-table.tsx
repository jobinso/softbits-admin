import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ShieldCheck, Plus, Trash2, Pencil, ExternalLink } from 'lucide-react';
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
import { deleteRole, getAccessSummary } from '@/services/admin-service';
import type { AccessSummary } from '@/services/admin-service';
import { useModal } from '@shared/hooks';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoleRow {
  id: string;
  name: string;
  description?: string;
  tabs?: string[];
  isSystem?: boolean;
}

interface RoleTableProps {
  roles: RoleRow[];
  onEdit: (role: RoleRow) => void;
  onCreate: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RoleTable({ roles, onEdit, onCreate }: RoleTableProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const deleteModal = useModal<RoleRow>();

  const { data: accessSummary } = useQuery({
    queryKey: ['admin', 'access', 'summary'],
    queryFn: getAccessSummary,
  });

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
    { key: 'access', label: 'Access' },
  ], []);

  // ---- Filtered data ----

  const filteredRoles = useMemo(() => {
    let result = roles;

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          r.id.toLowerCase().includes(s) ||
          (r.description && r.description.toLowerCase().includes(s))
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
  }, [roles, search, filters, filterFields]);

  // ---- Mutations ----

  const deleteMutation = useMutation({
    mutationFn: (roleId: string) => deleteRole(roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      deleteModal.close();
      toast.success('Role deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete role'),
  });

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
      key: 'access',
      label: 'Access',
      width: 200,
      sortable: false,
      hidden: columnVisibility.access === false,
      render: (_val, row) => {
        const summary: AccessSummary | undefined = accessSummary?.[row.id];
        const granted = summary?.granted ?? 0;
        const total = summary?.total ?? 0;
        const isWildcard = row.id === 'admin';
        return (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <StatusBadge
              status={granted > 0 ? 'info' : 'neutral'}
              label={isWildcard ? 'wildcard' : `${granted} / ${total}`}
              size="sm"
            />
            <Link
              to={`/security/access?roleId=${encodeURIComponent(row.id)}`}
              className="inline-flex items-center gap-0.5 text-xs text-primary hover:text-primary-400"
              title="Configure access"
            >
              Configure
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
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
            onClick={(e) => { e.stopPropagation(); onEdit(row); }}
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

  return (
    <>
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
            <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={onCreate}>
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
          onRowClick={onEdit}
          emptyMessage="No roles found"
          emptyIcon={ShieldCheck}
          embedded
          showColumnPicker={false}
          showFilters={false}
        />
      </TableCard>

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
    </>
  );
}
