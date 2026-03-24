import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, Plus, Copy, Check, ShieldOff, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  Modal,
  DataTable,
  StatusBadge,
  LoadingSpinner,
  PageHeader,
  TableCard,
  TableFilterDropdown,
  TableColumnPicker,
} from '@/components/shared';
import type { ColumnDef, TableFilterField, TableColumnPickerColumn } from '@/components/shared';
import type { ApiToken } from '@/types';
import {
  getTokens,
  getUsers,
  createToken,
  deactivateToken,
  reactivateToken,
  deleteToken,
} from '@/services/admin-service';

function maskToken(token: string): string {
  if (!token || token.length <= 8) return token || '';
  return token.substring(0, 8) + '...';
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTokenStatus(token: ApiToken): { status: 'success' | 'danger' | 'warning' | 'neutral'; label: string } {
  if (!token.active) return { status: 'danger', label: 'Revoked' };
  if (token.expired) return { status: 'warning', label: 'Expired' };
  return { status: 'success', label: 'Active' };
}

const ALL_PERMISSIONS = ['get', 'post', 'browse', 'build', 'utils'] as const;

interface UserOption {
  id: string;
  username: string;
  fullName?: string;
}

export default function TokensPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createdTokenValue, setCreatedTokenValue] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'deactivate' | 'reactivate' | 'delete'; token: ApiToken } | null>(null);
  const [search, setSearch] = useState('');

  // Form state
  const [tokenName, setTokenName] = useState('');
  const [tokenDescription, setTokenDescription] = useState('');
  const [expiryDays, setExpiryDays] = useState<string>('90');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([...ALL_PERMISSIONS]);

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
    { key: 'tokenType', label: 'Scope', type: 'select', options: [{ value: 'standalone', label: 'Global' }, { value: 'user', label: 'App-specific' }] },
    { key: 'active', label: 'Status', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'expired', label: 'Expired' }, { value: 'revoked', label: 'Revoked' }] },
    { key: 'name', label: 'Name', type: 'text' },
  ], []);

  const pickerColumns: TableColumnPickerColumn[] = useMemo(() => [
    { key: 'name', label: 'Name' },
    { key: 'tokenPrefix', label: 'Token Prefix' },
    { key: 'tokenType', label: 'Scope' },
    { key: 'active', label: 'Status' },
    { key: 'createdBy', label: 'Created By' },
    { key: 'createdAt', label: 'Created' },
    { key: 'expiresAt', label: 'Expires' },
  ], []);

  const { data: tokensResponse, isLoading } = useQuery({
    queryKey: ['admin', 'tokens'],
    queryFn: getTokens,
  });

  const tokens: ApiToken[] = tokensResponse?.tokens || [];

  const { data: usersResponse } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: getUsers,
  });
  const users: UserOption[] = usersResponse?.users || [];

  // ---- Filtered data ----

  const filteredTokens = useMemo(() => {
    let result = tokens;

    // Apply search
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((t) => {
        const row = t as any;
        return (
          (row.name && String(row.name).toLowerCase().includes(s)) ||
          (row.tokenPrefix && String(row.tokenPrefix).toLowerCase().includes(s)) ||
          (row.createdBy && String(row.createdBy).toLowerCase().includes(s))
        );
      });
    }

    // Apply column filters
    const activeFilters = Object.entries(filters).filter(([, v]) => v);
    if (activeFilters.length > 0) {
      result = result.filter((row) =>
        activeFilters.every(([key, value]) => {
          if (key === 'active') {
            const { label } = getTokenStatus(row);
            return label.toLowerCase() === value;
          }
          const rowVal = (row as any)[key];
          if (rowVal == null) return false;
          const field = filterFields.find((f) => f.key === key);
          if (field?.type === 'select') return String(rowVal) === value;
          return String(rowVal).toLowerCase().includes(value.toLowerCase());
        })
      );
    }

    return result;
  }, [tokens, search, filters, filterFields]);

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; expiresInDays?: number; userId?: string; permissions?: string[] }) => createToken(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tokens'] });
      setCreatedTokenValue(data.token);
      toast.success('Token created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create token');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateToken,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tokens'] });
      toast.success('Token deactivated');
      setConfirmAction(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to deactivate token');
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: reactivateToken,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tokens'] });
      toast.success('Token reactivated');
      setConfirmAction(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to reactivate token');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteToken,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tokens'] });
      toast.success('Token deleted');
      setConfirmAction(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete token');
    },
  });

  const togglePermission = (perm: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const toggleAllPermissions = (checked: boolean) => {
    setSelectedPermissions(checked ? [...ALL_PERMISSIONS] : []);
  };

  const allPermissionsSelected = selectedPermissions.length === ALL_PERMISSIONS.length;

  const handleCreate = () => {
    if (!tokenName.trim()) {
      toast.error('Token name is required');
      return;
    }
    if (selectedPermissions.length === 0) {
      toast.error('At least one permission is required');
      return;
    }
    createMutation.mutate({
      name: tokenName.trim(),
      description: tokenDescription.trim() || undefined,
      expiresInDays: expiryDays === 'never' ? undefined : Number(expiryDays),
      userId: selectedUserId || undefined,
      permissions: allPermissionsSelected ? undefined : selectedPermissions,
    });
  };

  const handleCopy = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-secure contexts (e.g. HTTP on LAN IP)
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      toast.success('Token copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy token');
    }
  };

  const handleCloseCreate = () => {
    setShowCreateModal(false);
    setCreatedTokenValue(null);
    setTokenName('');
    setTokenDescription('');
    setExpiryDays('90');
    setSelectedUserId('');
    setSelectedPermissions([...ALL_PERMISSIONS]);
    setCopied(false);
  };

  const handleConfirmAction = () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'deactivate') {
      deactivateMutation.mutate(confirmAction.token.id);
    } else if (confirmAction.type === 'reactivate') {
      reactivateMutation.mutate(confirmAction.token.id);
    } else if (confirmAction.type === 'delete') {
      deleteMutation.mutate(confirmAction.token.id);
    }
  };

  const columns: ColumnDef<ApiToken>[] = useMemo(
    () => [
      {
        key: 'name',
        label: 'Name',
        sortable: true,
        hidden: columnVisibility.name === false,
        width: 200,
      },
      {
        key: 'tokenPrefix',
        label: 'Token Prefix',
        hidden: columnVisibility.tokenPrefix === false,
        width: 140,
        render: (val: string) => (
          <span className="font-mono text-xs text-semantic-text-faint">{val ? maskToken(val) : '-'}</span>
        ),
      },
      {
        key: 'tokenType',
        label: 'Scope',
        width: 100,
        sortable: true,
        hidden: columnVisibility.tokenType === false,
        render: (val: string) => (
          <span className="capitalize">{val || 'standalone'}</span>
        ),
      },
      {
        key: 'active',
        label: 'Status',
        width: 110,
        sortable: true,
        hidden: columnVisibility.active === false,
        render: (_val: boolean, row: ApiToken) => {
          const { status, label } = getTokenStatus(row);
          return <StatusBadge status={status} label={label} size="sm" />;
        },
      },
      {
        key: 'createdBy',
        label: 'Created By',
        width: 140,
        sortable: true,
        hidden: columnVisibility.createdBy === false,
        render: (val: string) => val || '-',
      },
      {
        key: 'createdAt',
        label: 'Created',
        width: 160,
        sortable: true,
        hidden: columnVisibility.createdAt === false,
        render: (val: string) => formatDate(val),
      },
      {
        key: 'expiresAt',
        label: 'Expires',
        width: 160,
        sortable: true,
        hidden: columnVisibility.expiresAt === false,
        render: (val: string | null) => (val ? formatDate(val) : 'Never'),
      },
      {
        key: '_actions',
        label: 'Actions',
        width: 180,
        noTruncate: true,
        sortable: false,
        render: (_val: unknown, row: ApiToken) => (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {row.active ? (
              <Button
                variant="ghost"
                size="sm"
                icon={<ShieldOff className="w-3.5 h-3.5" />}
                onClick={() => setConfirmAction({ type: 'deactivate', token: row })}
              >
                Revoke
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                icon={<Key className="w-3.5 h-3.5" />}
                onClick={() => setConfirmAction({ type: 'reactivate', token: row })}
              >
                Reactivate
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 className="w-3.5 h-3.5 text-danger" />}
              onClick={() => setConfirmAction({ type: 'delete', token: row })}
            />
          </div>
        ),
      },
    ],
    [columnVisibility]
  );

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
        title="All Tokens"
        icon={<Key className="w-4 h-4" />}
        count={filteredTokens.length}
        search={{ value: search, onChange: setSearch, placeholder: "Search tokens by name, prefix, or creator..." }}
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
            <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowCreateModal(true)}>
              Create Token
            </Button>
          </div>
        }
      >
        <DataTable<ApiToken>
          id="admin-tokens"
          columns={columns}
          data={filteredTokens}
          rowKey="id"
          emptyMessage="No API tokens found"
          emptyIcon={Key}
          embedded
          showColumnPicker={false}
          showFilters={false}
        />
      </TableCard>

      {/* Create Token Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={handleCloseCreate}
        title={createdTokenValue ? 'Token Created' : 'Create API Token'}
        size="md"
        footer={
          createdTokenValue ? (
            <Button onClick={handleCloseCreate}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={handleCloseCreate}>
                Cancel
              </Button>
              <Button onClick={handleCreate} loading={createMutation.isPending}>
                Create Token
              </Button>
            </>
          )
        }
      >
        {createdTokenValue ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 bg-warning-50 border border-warning/30 rounded-lg text-sm text-warning">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <span>This token will only be shown once. Copy it now.</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-surface-overlay border border-border rounded-lg p-3 font-mono text-sm text-semantic-text-secondary break-all select-all">
                {createdTokenValue}
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                onClick={() => handleCopy(createdTokenValue)}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-semantic-text-secondary mb-1">Token Name</label>
              <input
                type="text"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder="e.g. CI/CD Pipeline"
                className="w-full px-3 py-2 bg-surface-overlay border border-border rounded-lg text-sm text-semantic-text-default placeholder:text-semantic-text-faint focus:outline-none focus:ring-2 focus:ring-interactive-focus-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-semantic-text-secondary mb-1">Description</label>
              <input
                type="text"
                value={tokenDescription}
                onChange={(e) => setTokenDescription(e.target.value)}
                placeholder="What is this token used for?"
                className="w-full px-3 py-2 bg-surface-overlay border border-border rounded-lg text-sm text-semantic-text-default placeholder:text-semantic-text-faint focus:outline-none focus:ring-2 focus:ring-interactive-focus-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-semantic-text-secondary mb-1">Expiry</label>
              <select
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
                className="w-full px-3 py-2 bg-surface-overlay border border-border rounded-lg text-sm text-semantic-text-default focus:outline-none focus:ring-2 focus:ring-interactive-focus-ring"
              >
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="365">1 year</option>
                <option value="never">Never</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-semantic-text-secondary mb-1">
                Link to User <span className="text-semantic-text-faint font-normal">(optional)</span>
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 bg-surface-overlay border border-border rounded-lg text-sm text-semantic-text-default focus:outline-none focus:ring-2 focus:ring-interactive-focus-ring"
              >
                <option value="">None (standalone token)</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName || user.username} ({user.username})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-semantic-text-secondary mb-1">Permissions</label>
              <div className="space-y-2 p-3 bg-surface-overlay border border-border rounded-lg">
                <label className="flex items-center gap-2 text-sm text-semantic-text-subtle cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allPermissionsSelected}
                    onChange={(e) => toggleAllPermissions(e.target.checked)}
                    className="rounded border-border bg-surface-subtle text-primary focus:ring-interactive-focus-ring"
                  />
                  Select All
                </label>
                <div className="border-t border-border pt-2 space-y-1.5">
                  {ALL_PERMISSIONS.map((perm) => (
                    <label key={perm} className="flex items-center gap-2 text-sm text-semantic-text-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPermissions.includes(perm)}
                        onChange={() => togglePermission(perm)}
                        className="rounded border-border bg-surface-subtle text-primary focus:ring-interactive-focus-ring"
                      />
                      {perm}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm Action Modal */}
      <Modal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={
          confirmAction?.type === 'delete'
            ? 'Delete Token'
            : confirmAction?.type === 'deactivate'
              ? 'Revoke Token'
              : 'Reactivate Token'
        }
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmAction?.type === 'delete' ? 'danger' : 'primary'}
              onClick={handleConfirmAction}
              loading={deactivateMutation.isPending || reactivateMutation.isPending || deleteMutation.isPending}
            >
              {confirmAction?.type === 'delete'
                ? 'Delete'
                : confirmAction?.type === 'deactivate'
                  ? 'Revoke'
                  : 'Reactivate'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-semantic-text-secondary">
          {confirmAction?.type === 'delete' && (
            <>Are you sure you want to permanently delete the token <strong>{confirmAction.token.name}</strong>? This action cannot be undone.</>
          )}
          {confirmAction?.type === 'deactivate' && (
            <>Are you sure you want to revoke the token <strong>{confirmAction?.token.name}</strong>? It will no longer be usable for API access.</>
          )}
          {confirmAction?.type === 'reactivate' && (
            <>Are you sure you want to reactivate the token <strong>{confirmAction?.token.name}</strong>?</>
          )}
        </p>
      </Modal>
    </div>
  );
}
