import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package,
  CheckCircle,
  History,
  AlertTriangle,
  RotateCcw,
  Play,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Tabs, StatusBadge, LoadingSpinner, Modal, DataTable, PageHeader, PageStatusBar } from '@/components/shared';
import type { TabItem, ColumnDef, StatusBarItem } from '@/components/shared';
import type { Patch, PatchHistoryEntry, ApiError } from '@/types';
import {
  getPatches,
  getPatchLevel,
  getPatchHistory,
  applyPatch,
  rollbackPatch,
} from '@/services/admin-service';

// ===== Constants =====

const tabs: TabItem[] = [
  { id: 'overview', label: 'Pending', icon: <AlertTriangle className="w-4 h-4" /> },
  { id: 'installed', label: 'Installed', icon: <CheckCircle className="w-4 h-4" /> },
  { id: 'history', label: 'History', icon: <History className="w-4 h-4" /> },
];

// ===== Helpers =====

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(ms?: number | null): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getSeverityBadge(severity: string): { status: 'danger' | 'warning' | 'info' | 'neutral'; label: string } {
  switch (severity) {
    case 'critical': return { status: 'danger', label: 'Critical' };
    case 'important': return { status: 'warning', label: 'Important' };
    case 'recommended': return { status: 'info', label: 'Recommended' };
    default: return { status: 'neutral', label: severity || 'Optional' };
  }
}

function getActionColor(action: string): 'success' | 'warning' | 'neutral' {
  if (action === 'applied') return 'success';
  if (action === 'rolled_back') return 'warning';
  return 'neutral';
}

function getStatusColor(status: string): 'success' | 'danger' | 'warning' | 'neutral' {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'in_progress') return 'warning';
  return 'neutral';
}

// ===== Main Component =====

export default function PatchesPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [confirmAction, setConfirmAction] = useState<{ type: 'apply' | 'rollback'; patchCode: string } | null>(null);

  // ===== Queries =====

  const { data: levelData } = useQuery({
    queryKey: ['admin', 'patches', 'level'],
    queryFn: getPatchLevel,
  });

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['admin', 'patches', 'pending'],
    queryFn: () => getPatches({ status: 'pending' }),
    enabled: activeTab === 'overview',
  });

  const { data: installedData, isLoading: installedLoading } = useQuery({
    queryKey: ['admin', 'patches', 'installed'],
    queryFn: () => getPatches({ status: 'applied' }),
    enabled: activeTab === 'installed',
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['admin', 'patches', 'history'],
    queryFn: () => getPatchHistory({ limit: 50 }),
    enabled: activeTab === 'history',
  });

  // ===== Mutations =====

  const applyMutation = useMutation({
    mutationFn: (patchCode: string) => applyPatch(patchCode),
    onSuccess: (_data, patchCode) => {
      toast.success(`Patch ${patchCode} applied successfully`);
      setConfirmAction(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'patches'] });
    },
    onError: (error: ApiError, patchCode) => {
      toast.error(`Failed to apply patch ${patchCode}: ${error.response?.data?.error || error.message}`);
      setConfirmAction(null);
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: (patchCode: string) => rollbackPatch(patchCode),
    onSuccess: (_data, patchCode) => {
      toast.success(`Patch ${patchCode} rolled back successfully`);
      setConfirmAction(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'patches'] });
    },
    onError: (error: ApiError, patchCode) => {
      toast.error(`Failed to roll back ${patchCode}: ${error.response?.data?.error || error.message}`);
      setConfirmAction(null);
    },
  });

  // ===== Derived =====

  const level = (levelData as any)?.data || levelData || {};
  const pendingPatches: Patch[] = (pendingData as any)?.data || [];
  const installedPatches: Patch[] = (installedData as any)?.data || [];
  const historyEntries: PatchHistoryEntry[] = (historyData as any)?.data || [];

  // Group pending by severity
  const severityOrder = ['critical', 'important', 'recommended', 'optional'];
  const pendingGrouped: Record<string, Patch[]> = {};
  for (const p of pendingPatches) {
    const sev = p.Severity || 'optional';
    if (!pendingGrouped[sev]) pendingGrouped[sev] = [];
    pendingGrouped[sev].push(p);
  }

  // Installed table columns
  const installedColumns: ColumnDef<Patch>[] = [
    {
      key: 'PatchCode',
      label: 'Code',
      width: 160,
      sortable: true,
      render: (val: string) => <code className="text-primary font-mono text-xs">{val}</code>,
    },
    { key: 'Title', label: 'Title', width: 250, sortable: true },
    {
      key: 'Category',
      label: 'Category',
      width: 120,
      sortable: true,
      filterable: true,
      filterType: 'select',
      filterOptions: [
        { value: 'hotfix', label: 'Hotfix' },
        { value: 'service-pack', label: 'Service Pack' },
        { value: 'feature-update', label: 'Feature Update' },
        { value: 'security', label: 'Security' },
      ],
      render: (val: string) => <span className="text-xs text-dark-500 bg-dark-100 px-2 py-0.5 rounded">{val}</span>,
    },
    {
      key: 'Severity',
      label: 'Severity',
      width: 120,
      sortable: true,
      render: (val: string) => {
        const badge = getSeverityBadge(val);
        return <StatusBadge status={badge.status} label={badge.label} size="sm" />;
      },
    },
    {
      key: 'AppliedAt',
      label: 'Applied',
      width: 180,
      sortable: true,
      render: (val: string) => <span className="text-xs text-dark-500">{formatDate(val)}</span>,
    },
    {
      key: 'AppliedBy',
      label: 'By',
      width: 100,
      render: (val: string) => <span className="text-xs text-dark-500">{val || '-'}</span>,
    },
    {
      key: 'ApplyDurationMs',
      label: 'Duration',
      width: 90,
      align: 'right',
      render: (val: number) => <span className="text-xs text-dark-500 font-mono">{formatDuration(val)}</span>,
    },
    {
      key: '_actions',
      label: '',
      width: 90,
      sortable: false,
      render: (_val: unknown, row: Patch) => (
        <Button
          variant="ghost"
          size="sm"
          className="text-danger hover:text-danger"
          onClick={(e) => { e.stopPropagation(); setConfirmAction({ type: 'rollback', patchCode: row.PatchCode }); }}
        >
          Rollback
        </Button>
      ),
    },
  ];

  // History table columns
  const historyColumns: ColumnDef<PatchHistoryEntry>[] = [
    {
      key: 'StartedAt',
      label: 'Timestamp',
      width: 180,
      sortable: true,
      render: (val: string) => <span className="text-xs text-dark-500">{formatDate(val)}</span>,
    },
    {
      key: 'PatchCode',
      label: 'Patch',
      width: 150,
      sortable: true,
      render: (val: string) => <code className="text-primary font-mono text-xs">{val}</code>,
    },
    { key: 'PatchTitle', label: 'Title', width: 200, sortable: true },
    {
      key: 'Action',
      label: 'Action',
      width: 100,
      sortable: true,
      render: (val: string) => <StatusBadge status={getActionColor(val)} label={val} size="sm" />,
    },
    {
      key: 'Status',
      label: 'Status',
      width: 100,
      sortable: true,
      render: (val: string) => <StatusBadge status={getStatusColor(val)} label={val} size="sm" />,
    },
    {
      key: 'AppliedBy',
      label: 'User',
      width: 100,
      render: (val: string) => <span className="text-xs text-dark-500">{val || '-'}</span>,
    },
    {
      key: 'DurationMs',
      label: 'Duration',
      width: 90,
      align: 'right',
      render: (val: number) => <span className="text-xs text-dark-500 font-mono">{formatDuration(val)}</span>,
    },
    {
      key: 'ErrorMessage',
      label: 'Error',
      width: 200,
      render: (val: string) => val ? <span className="text-xs text-danger truncate" title={val}>{val}</span> : null,
    },
  ];

  // ===== Render =====

  return (
    <div className="space-y-6">
      <PageHeader
        title="Updates & Patches"
        description="Review pending patches, apply updates, and view history"
        icon={<Package className="w-5 h-5" />}
      />

      <PageStatusBar
        items={[
          { type: 'text', label: 'Bridge Version', value: '2.1.0' },
          { type: 'text', label: 'Patches Applied', value: level.TotalApplied ?? 0, colorClass: 'text-primary' },
          { type: 'text', label: 'Latest Patch', value: level.LatestPatch || 'None' },
          {
            type: 'text',
            label: 'Critical Pending',
            value: (level.PendingCritical ?? 0) > 0 ? `${level.PendingCritical}` : '0',
            colorClass: (level.PendingCritical ?? 0) > 0 ? 'text-danger' : undefined,
            visible: (level.PendingCritical ?? 0) > 0,
          },
        ] as StatusBarItem[]}
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab: Pending */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {pendingLoading ? (
            <div className="text-center py-12"><LoadingSpinner size="md" /></div>
          ) : pendingPatches.length === 0 ? (
            <div className="text-center py-16">
              <CheckCircle className="w-12 h-12 text-primary mx-auto mb-4" />
              <p className="text-sm font-semibold text-dark-700 mb-1">All up to date</p>
              <p className="text-xs text-dark-400">No pending patches to apply.</p>
            </div>
          ) : (
            severityOrder.map((severity) => {
              const items = pendingGrouped[severity];
              if (!items || items.length === 0) return null;
              const badge = getSeverityBadge(severity);
              return (
                <div key={severity}>
                  <div className="flex items-center gap-2 mb-3">
                    <StatusBadge status={badge.status} label={badge.label} size="sm" />
                    <span className="text-xs text-dark-400">{items.length} patch{items.length > 1 ? 'es' : ''}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((patch) => (
                      <div
                        key={patch.PatchCode}
                        className="flex items-center justify-between p-4 bg-dark-50 border border-dark-200 rounded-lg hover:border-dark-300 transition-colors"
                      >
                        <div className="min-w-0 flex-1 mr-4">
                          <div className="flex items-center gap-2 mb-1">
                            <code className="text-primary font-mono text-sm font-semibold">{patch.PatchCode}</code>
                            <span className="text-xs text-dark-500 bg-dark-100 px-2 py-0.5 rounded">{patch.Category}</span>
                          </div>
                          <p className="text-sm font-medium text-dark-700">{patch.Title}</p>
                          {patch.Description && (
                            <p className="text-xs text-dark-400 mt-1">{patch.Description}</p>
                          )}
                          <p className="text-xs text-dark-400 mt-1">Released: {formatDate(patch.ReleasedAt)}</p>
                        </div>
                        <Button
                          size="sm"
                          icon={<Play className="w-3.5 h-3.5" />}
                          onClick={() => setConfirmAction({ type: 'apply', patchCode: patch.PatchCode })}
                        >
                          Apply
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab: Installed */}
      {activeTab === 'installed' && (
        <div>
          {installedLoading ? (
            <div className="text-center py-12"><LoadingSpinner size="md" /></div>
          ) : installedPatches.length === 0 ? (
            <div className="text-center py-12 text-sm text-dark-400">No patches installed yet.</div>
          ) : (
            <DataTable
              id="patches-installed"
              columns={installedColumns}
              data={installedPatches}
              rowKey="PatchCode"
              pageSize={25}
              showColumnPicker={false}
            />
          )}
        </div>
      )}

      {/* Tab: History */}
      {activeTab === 'history' && (
        <div>
          {historyLoading ? (
            <div className="text-center py-12"><LoadingSpinner size="md" /></div>
          ) : historyEntries.length === 0 ? (
            <div className="text-center py-12 text-sm text-dark-400">No patch history yet.</div>
          ) : (
            <DataTable
              id="patches-history"
              columns={historyColumns}
              data={historyEntries}
              rowKey={(row) => `${row.PatchCode}-${row.StartedAt}`}
              pageSize={25}
              showColumnPicker={false}
            />
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.type === 'apply' ? 'Apply Patch' : 'Rollback Patch'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              variant={confirmAction?.type === 'rollback' ? 'danger' : 'primary'}
              icon={confirmAction?.type === 'rollback'
                ? <RotateCcw className="w-3.5 h-3.5" />
                : <Play className="w-3.5 h-3.5" />}
              loading={applyMutation.isPending || rollbackMutation.isPending}
              onClick={() => {
                if (!confirmAction) return;
                if (confirmAction.type === 'apply') {
                  applyMutation.mutate(confirmAction.patchCode);
                } else {
                  rollbackMutation.mutate(confirmAction.patchCode);
                }
              }}
            >
              {confirmAction?.type === 'apply' ? 'Apply' : 'Rollback'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {confirmAction?.type === 'apply' ? (
            <>
              <p className="text-sm text-dark-600">
                Apply patch <code className="text-primary font-mono font-semibold">{confirmAction.patchCode}</code>?
              </p>
              <p className="text-xs text-dark-400">
                This will execute the patch SQL against the database.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-dark-600">
                Roll back patch <code className="text-primary font-mono font-semibold">{confirmAction?.patchCode}</code>?
              </p>
              <p className="text-xs text-dark-400">
                This will execute the rollback SQL and remove the patch.
              </p>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
