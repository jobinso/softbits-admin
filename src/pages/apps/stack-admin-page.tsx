import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw,
  Server,
  Settings,
  Activity,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  StatusBadge,
  LoadingSpinner,
  Tabs,
  Card,
  PageHeader,
} from '@/components/shared';
import type { TabItem } from '@/components/shared';
import {
  getStackStatus,
  getStackDashboard,
  getStackServices,
  getStackConfig,
  getStackWebsocket,
  updateStackService,
  restartStackService,
} from '@/services/admin-service';
import type { StackService, StackActiveOperation } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STACK_TABS: TabItem[] = [
  { id: 'status', label: 'Dashboard', icon: <Activity className="w-4 h-4" /> },
  { id: 'services', label: 'Services', icon: <Server className="w-4 h-4" /> },
  { id: 'config', label: 'Configuration', icon: <Settings className="w-4 h-4" /> },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUptime(seconds?: number): string {
  if (!seconds) return '-';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatConfigValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StackAdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('status');

  // ==== Queries ====

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['stack', 'status'],
    queryFn: getStackStatus,
    refetchInterval: 15000,
  });

  const { data: dashboardData } = useQuery({
    queryKey: ['stack', 'dashboard'],
    queryFn: getStackDashboard,
    refetchInterval: 15000,
    enabled: activeTab === 'status',
  });

  const { data: servicesData } = useQuery({
    queryKey: ['stack', 'services'],
    queryFn: getStackServices,
    enabled: activeTab === 'services',
  });

  const { data: websocketData } = useQuery({
    queryKey: ['stack', 'websocket'],
    queryFn: getStackWebsocket,
    enabled: activeTab === 'status',
  });

  const { data: configData } = useQuery({
    queryKey: ['stack', 'config'],
    queryFn: getStackConfig,
    enabled: activeTab === 'config',
  });

  // Derived data
  const status = statusData?.status || statusData;
  const isConnected = status?.connected !== false && !!statusData;
  const uptime = status?.uptime;
  const dashboard = dashboardData?.data || dashboardData;
  const services: StackService[] = servicesData?.data || servicesData?.services || [];
  const wsData = websocketData?.websocket || websocketData;
  const config = configData?.data || configData?.config || configData;
  const activeOps: StackActiveOperation[] = dashboard?.activeOperations || [];

  const picksPending = dashboard?.picksPending ?? dashboard?.picks?.pending ?? 0;
  const packsPending = dashboard?.packsPending ?? dashboard?.packs?.pending ?? 0;
  const shipsPending = dashboard?.shipsPending ?? dashboard?.ships?.pending ?? 0;
  const completedToday = dashboard?.completedToday ?? dashboard?.completed?.today ?? 0;

  // ==== Mutations ====

  const toggleServiceMut = useMutation({
    mutationFn: ({ name, enabled }: { name: string; enabled: boolean }) => updateStackService(name, { enabled }),
    onSuccess: (_data, { name, enabled }) => {
      queryClient.invalidateQueries({ queryKey: ['stack', 'services'] });
      queryClient.invalidateQueries({ queryKey: ['stack', 'status'] });
      toast.success(`Service ${name} ${enabled ? 'enabled' : 'disabled'}`);
    },
    onError: () => toast.error('Failed to update service'),
  });

  const updateIntervalMut = useMutation({
    mutationFn: ({ name, interval }: { name: string; interval: number }) => updateStackService(name, { interval }),
    onSuccess: (_data, { name }) => {
      queryClient.invalidateQueries({ queryKey: ['stack', 'services'] });
      toast.success(`Service ${name} interval updated`);
    },
    onError: () => toast.error('Failed to update interval'),
  });

  const restartServiceMut = useMutation({
    mutationFn: (name: string) => restartStackService(name),
    onSuccess: (_data, name) => {
      queryClient.invalidateQueries({ queryKey: ['stack', 'services'] });
      queryClient.invalidateQueries({ queryKey: ['stack', 'status'] });
      toast.success(`Service ${name} restarted`);
    },
    onError: () => toast.error('Failed to restart service'),
  });

  // ==== Render ====

  if (statusLoading) {
    return <div className="flex items-center justify-center h-full"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="StackIT"
        description="Warehouse management configuration"
      />

      {/* Status Bar — pill style matching Licensing */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 p-4 bg-surface-raised border border-border rounded-xl">
        <div>
          <p className="text-xs text-semantic-text-faint mb-1">Service</p>
          <StatusBadge status={isConnected ? 'success' : 'danger'} label={isConnected ? 'Connected' : 'Offline'} size="sm" />
        </div>
        <div>
          <p className="text-xs text-semantic-text-faint mb-1">Uptime</p>
          <p className="text-sm font-medium text-semantic-text-default">{formatUptime(uptime)}</p>
        </div>
        <div>
          <p className="text-xs text-semantic-text-faint mb-1">Services</p>
          <p className="text-sm font-medium text-semantic-text-default">
            {status?.services ? Object.values(status.services as Record<string, { running: boolean }>).filter((s) => s.running).length : '-'}
          </p>
        </div>
        <div>
          <p className="text-xs text-semantic-text-faint mb-1">WebSocket</p>
          <StatusBadge status={wsData?.enabled ? 'success' : 'neutral'} label={wsData?.enabled ? `Active (${wsData.connections ?? 0})` : 'Inactive'} size="sm" />
        </div>
        <div>
          <p className="text-xs text-semantic-text-faint mb-1">Picks Pending</p>
          <p className={`text-sm font-semibold tabular-nums ${picksPending > 0 ? 'text-warning' : 'text-semantic-text-faint'}`}>{picksPending}</p>
        </div>
        <div>
          <p className="text-xs text-semantic-text-faint mb-1">Packs Pending</p>
          <p className={`text-sm font-semibold tabular-nums ${packsPending > 0 ? 'text-warning' : 'text-semantic-text-faint'}`}>{packsPending}</p>
        </div>
        <div>
          <p className="text-xs text-semantic-text-faint mb-1">Ships Pending</p>
          <p className={`text-sm font-semibold tabular-nums ${shipsPending > 0 ? 'text-warning' : 'text-semantic-text-faint'}`}>{shipsPending}</p>
        </div>
        <div>
          <p className="text-xs text-semantic-text-faint mb-1">Completed Today</p>
          <p className={`text-sm font-semibold tabular-nums ${completedToday > 0 ? 'text-success' : 'text-semantic-text-faint'}`}>{completedToday}</p>
        </div>
      </div>

      <Tabs tabs={STACK_TABS} activeTab={activeTab} onChange={setActiveTab} />

      {/* ===== Status Tab ===== */}
      {activeTab === 'status' && (
        <div className="space-y-4">

          {/* Active Operations */}
          <Card title="Active Operations" headerAction={
            <Button variant="ghost" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => queryClient.invalidateQueries({ queryKey: ['stack', 'dashboard'] })}>
              Refresh
            </Button>
          }>
            {activeOps.length === 0 ? (
              <p className="text-center text-semantic-text-faint text-sm py-6">No active operations</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left text-xs font-medium text-semantic-text-faint">Order</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-semantic-text-faint">Customer</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-semantic-text-faint">Type</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-semantic-text-faint">Lines</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-semantic-text-faint">Operator</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-semantic-text-faint">Started</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-semantic-text-faint">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {activeOps.map((op, idx) => (
                      <tr key={idx} className="hover:bg-interactive-hover">
                        <td className="px-3 py-2 font-medium text-semantic-text-default">{op.orderNumber || '-'}</td>
                        <td className="px-3 py-2 text-semantic-text-subtle">{op.customer || '-'}</td>
                        <td className="px-3 py-2">
                          <OperationTypeBadge type={op.type} />
                        </td>
                        <td className="px-3 py-2 text-semantic-text-subtle">{op.lines ?? '-'}</td>
                        <td className="px-3 py-2 text-semantic-text-subtle">{op.operator || '-'}</td>
                        <td className="px-3 py-2 text-semantic-text-subtle">{op.startTime ? new Date(op.startTime).toLocaleTimeString() : '-'}</td>
                        <td className="px-3 py-2">
                          <StatusBadge
                            status={op.status === 'In Progress' ? 'success' : op.status === 'Paused' ? 'warning' : 'neutral'}
                            label={op.status || 'Active'}
                            size="sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ===== Services Tab ===== */}
      {activeTab === 'services' && (
        <Card title={`Services (${services.length})`} headerAction={
          <Button variant="ghost" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => queryClient.invalidateQueries({ queryKey: ['stack', 'services'] })}>
            Refresh
          </Button>
        }>
          {services.length === 0 ? (
            <p className="text-center text-semantic-text-faint text-sm py-6">No services configured</p>
          ) : (
            <div className="space-y-2">
              {services.map((svc) => (
                <div key={svc.name} className="flex items-center justify-between p-3 bg-interactive-hover border border-border rounded-lg">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-semantic-text-default">{svc.displayName || svc.name}</p>
                      <StatusBadge
                        status={svc.running || svc.status === 'Running' || svc.status === 'Active' ? 'success' : 'danger'}
                        label={svc.running || svc.status === 'Running' || svc.status === 'Active' ? 'Running' : 'Stopped'}
                        size="sm"
                      />
                    </div>
                    {svc.description && <p className="text-xs text-semantic-text-faint">{svc.description}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        defaultValue={svc.interval ? Math.round(svc.interval / 1000) : 5}
                        min={1}
                        max={3600}
                        className="w-16 px-2 py-1 bg-surface-overlay border border-border rounded text-sm text-semantic-text-secondary text-center"
                        onBlur={(e) => {
                          const seconds = parseInt(e.target.value);
                          if (seconds >= 1 && seconds <= 3600) {
                            updateIntervalMut.mutate({ name: svc.name, interval: seconds * 1000 });
                          }
                        }}
                      />
                      <span className="text-xs text-semantic-text-faint">sec</span>
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={svc.enabled}
                        onChange={(e) => toggleServiceMut.mutate({ name: svc.name, enabled: e.target.checked })}
                        className="w-4 h-4 rounded border-border text-primary"
                      />
                      <span className="text-xs text-semantic-text-faint">Enabled</span>
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<RefreshCw className="w-3.5 h-3.5" />}
                      onClick={() => restartServiceMut.mutate(svc.name)}
                      loading={restartServiceMut.isPending}
                      title="Restart"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ===== Config Tab ===== */}
      {activeTab === 'config' && (
        <Card title="Configuration" headerAction={
          <Button variant="ghost" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => queryClient.invalidateQueries({ queryKey: ['stack', 'config'] })}>
            Refresh
          </Button>
        }>
          {!config || Object.keys(config).length === 0 ? (
            <p className="text-center text-semantic-text-faint text-sm py-6">No configuration available</p>
          ) : (
            <div className="space-y-4">
              {groupConfigByCategory(config).map(([category, items]) => (
                <div key={category} className="rounded-lg border border-border overflow-hidden">
                  <div className="bg-surface-overlay px-4 py-2.5 border-b border-border">
                    <h4 className="text-xs font-semibold text-semantic-text-subtle uppercase tracking-wider">{category}</h4>
                  </div>
                  <div className="divide-y divide-border">
                    {items.map(({ key, value }) => (
                      <div key={key} className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm text-semantic-text-faint">{key}</span>
                        <span className="text-sm text-semantic-text-secondary font-mono">{formatConfigValue(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


function OperationTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    PICK: 'bg-amber-500/15 text-amber-500',
    PACK: 'bg-green-500/15 text-green-500',
    SHIP: 'bg-indigo-500/15 text-indigo-500',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[type] || 'bg-surface-subtle text-semantic-text-faint'}`}>
      {type || '-'}
    </span>
  );
}

function groupConfigByCategory(config: Record<string, unknown>): [string, { key: string; value: unknown }[]][] {
  const categories: Record<string, string[]> = {
    General: ['name', 'version', 'environment', 'enabled'],
    Database: ['database', 'server', 'host'],
    Services: ['apiUrl', 'apiPort', 'socketPort'],
  };

  const result: [string, { key: string; value: unknown }[]][] = [];
  const renderedKeys = new Set<string>();

  for (const [category, keys] of Object.entries(categories)) {
    const items: { key: string; value: unknown }[] = [];
    for (const [k, v] of Object.entries(config)) {
      if (keys.some((pattern) => k.toLowerCase().includes(pattern.toLowerCase()))) {
        items.push({ key: k, value: v });
        renderedKeys.add(k);
      }
    }
    if (items.length > 0) result.push([category, items]);
  }

  const other: { key: string; value: unknown }[] = [];
  for (const [k, v] of Object.entries(config)) {
    if (!renderedKeys.has(k)) other.push({ key: k, value: v });
  }
  if (other.length > 0) result.push(['Other', other]);

  return result;
}
