import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DataTable,
  Button,
  Card,
  StatusBadge,
} from '@/components/shared';
import type { ColumnDef } from '@/components/shared';
import {
  getConnectSyncHistory,
  clearConnectSyncHistory,
} from '@/services/admin-service';
import type { ConnectSyncHistoryEntry } from '@/types';

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

const historyColumns: ColumnDef<ConnectSyncHistoryEntry>[] = [
  { key: 'SyncedAt', label: 'Time', width: 160, sortable: true, render: (v) => new Date(v).toLocaleString() },
  { key: 'EntityType', label: 'Entity', width: 120, sortable: true },
  { key: 'Direction', label: 'Direction', width: 100, sortable: true },
  {
    key: 'Status', label: 'Status', width: 90, sortable: true,
    render: (v) => <StatusBadge status={v === 'success' ? 'success' : v === 'failed' ? 'danger' : 'warning'} label={v} size="sm" />,
  },
  { key: 'RecordsAffected', label: 'Records', width: 80, sortable: true },
  { key: 'ErrorMessage', label: 'Message', sortable: false, render: (v, row) => <span className="text-xs truncate max-w-[300px] block" title={v || row.Message || ''}>{v || row.Message || '-'}</span> },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConnectStatusTab() {
  const queryClient = useQueryClient();

  const { data: syncHistory } = useQuery({
    queryKey: ['connect', 'sync-history'],
    queryFn: () => getConnectSyncHistory({ limit: 50 }),
  });

  const clearHistoryMut = useMutation({
    mutationFn: clearConnectSyncHistory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'sync-history'] });
    },
  });

  const history: ConnectSyncHistoryEntry[] = syncHistory?.history ?? [];

  return (
    <div className="space-y-4">
      <Card title="Sync History" headerAction={
        <Button variant="ghost" size="sm" onClick={() => { if (window.confirm('Clear all sync history?')) clearHistoryMut.mutate(); }} disabled={history.length === 0}>
          Clear
        </Button>
      }>
        <DataTable<ConnectSyncHistoryEntry>
          id="connect-sync-history"
          columns={historyColumns}
          data={history}
          rowKey={(row) => row.Id || row.SyncedAt}
          emptyMessage="No sync history"
        />
      </Card>
    </div>
  );
}
