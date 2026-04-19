import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Square } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  Card,
} from '@/components/shared';
import {
  getConnectSyncStatus,
  getConnectConfig,
  triggerConnectSync,
  stopConnectSync,
  updateConnectConfig,
} from '@/services/admin-service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SYNC_ENTITIES = [
  { key: 'salesreps', label: 'Sales Reps' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'customers', label: 'Customers' },
  { key: 'accounts', label: 'Accounts' },
  { key: 'addresses', label: 'Addresses' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'activities', label: 'Activities' },
];

const SYNC_DIRECTIONS = [
  { value: 'from_syspro', label: 'ERP to CRM' },
  { value: 'to_syspro', label: 'CRM to ERP' },
  { value: 'bidirectional', label: 'Bidirectional' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConnectSyncTab() {
  const queryClient = useQueryClient();

  const { data: syncStatus } = useQuery({
    queryKey: ['connect', 'sync-status'],
    queryFn: getConnectSyncStatus,
    refetchInterval: 10000,
  });

  const { data: syncConfig } = useQuery({
    queryKey: ['connect', 'config'],
    queryFn: getConnectConfig,
  });

  const triggerSyncMut = useMutation({
    mutationFn: triggerConnectSync,
    onSuccess: (data) => {
      toast.success(data.message || 'Sync triggered');
      queryClient.invalidateQueries({ queryKey: ['connect', 'sync-status'] });
    },
    onError: () => toast.error('Failed to trigger sync'),
  });

  const stopSyncMut = useMutation({
    mutationFn: stopConnectSync,
    onSuccess: (data) => {
      toast.success(data.message || 'Sync stop requested');
      queryClient.invalidateQueries({ queryKey: ['connect', 'sync-status'] });
    },
    onError: () => toast.error('Failed to stop sync'),
  });

  const saveConfigMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => updateConnectConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'config'] });
      toast.success('Config saved');
    },
    onError: () => toast.error('Failed to save config'),
  });

  return (
    <div className="space-y-4">
      <Card title="Sync Controls">
        <div className="flex items-center gap-3">
          <Button
            icon={<Play className="w-4 h-4" />}
            onClick={() => triggerSyncMut.mutate()}
            loading={triggerSyncMut.isPending}
            disabled={syncStatus?.isRunning}
          >
            {syncStatus?.isRunning ? 'Syncing...' : 'Sync Now'}
          </Button>
          {syncStatus?.isRunning && (
            <Button
              variant="danger"
              icon={<Square className="w-4 h-4" />}
              onClick={() => stopSyncMut.mutate()}
              loading={stopSyncMut.isPending}
            >
              Stop
            </Button>
          )}
        </div>
      </Card>

      <Card title="Entity Sync Configuration">
        <div className="space-y-3">
          {SYNC_ENTITIES.map((entity) => {
            const configs = syncConfig?.data?.configs ?? [];
            const cfg = configs.find((c: { EntityType: string }) => c.EntityType?.toLowerCase() === entity.key);
            return (
              <div key={entity.key} className="flex items-center justify-between p-3 bg-dark-100/50 border border-dark-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked={cfg?.SyncEnabled ?? true} className="w-4 h-4 rounded border-dark-300 text-primary" id={`sync-${entity.key}`} />
                    <span className="text-sm text-dark-700 font-medium">{entity.label}</span>
                  </label>
                </div>
                <select
                  defaultValue={cfg?.SyncDirection || 'from_syspro'}
                  className="form-input text-sm w-40"
                  id={`dir-${entity.key}`}
                >
                  {SYNC_DIRECTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
            );
          })}
          <div className="pt-2">
            <Button
              onClick={() => {
                const config: Record<string, unknown> = {};
                for (const entity of SYNC_ENTITIES) {
                  const enabled = (document.getElementById(`sync-${entity.key}`) as HTMLInputElement)?.checked ?? true;
                  const direction = (document.getElementById(`dir-${entity.key}`) as HTMLSelectElement)?.value || 'from_syspro';
                  config[entity.key] = { enabled, direction };
                }
                saveConfigMut.mutate(config);
              }}
              loading={saveConfigMut.isPending}
            >
              Save Configuration
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
