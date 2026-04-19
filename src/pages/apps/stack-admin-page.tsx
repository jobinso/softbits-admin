import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw,
  Package,
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
  { id: 'status', label: 'Status', icon: <Activity className="w-4 h-4" /> },
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
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center gap-3">
        <Package className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold text-dark-700">StackIT Admin</h1>
      </div>

      {/* Status Bar */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-dark-400">Service:</span>
          <StatusBadge status={isConnected ? 'success' : 'danger'} label={isConnected ? 'Connected' : 'Offline'} size="sm" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-dark-400">Uptime:</span>
          <span className="text-dark-600 font-medium">{formatUptime(uptime)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-dark-400">Services:</span>
          <span className="text-dark-600 font-medium">
            {status?.services ? Object.values(status.services as Record<string, { running: boolean }>).filter((s) => s.running).length : '-'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-dark-400">WebSocket:</span>
          <StatusBadge
            status={wsData?.enabled ? 'success' : 'neutral'}
            label={wsData?.enabled ? `Active (${wsData.connections ?? 0})` : 'Inactive'}
            size="sm"
          />
        </div>
      </div>

      <Tabs tabs={STACK_TABS} activeTab={activeTab} onChange={setActiveTab} />

      {/* ===== Status Tab ===== */}
      {activeTab === 'status' && (
        <div className="space-y-4">
          {/* Operation Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Picks Pending" value={picksPending} color={picksPending > 0 ? 'warning' : 'muted'} />
            <StatCard label="Packs Pending" value={packsPending} color={packsPending > 0 ? 'warning' : 'muted'} />
            <StatCard label="Ships Pending" value={shipsPending} color={shipsPending > 0 ? 'warning' : 'muted'} />
            <StatCard label="Completed Today" value={completedToday} color={completedToday > 0 ? 'success' : 'muted'} />
          </div>

          {/* Active Operations */}
          <Card title="Active Operations" headerAction={
            <Button variant="ghost" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => queryClient.invalidateQueries({ queryKey: ['stack', 'dashboard'] })}>
              Refresh
            </Button>
          }>
            {activeOps.length === 0 ? (
              <p className="text-center text-dark-400 text-sm py-6">No active operations</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dark-200">
                      <th className="px-3 py-2 text-left text-xs font-medium text-dark-400">Order</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-dark-400">Customer</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-dark-400">Type</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-dark-400">Lines</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-dark-400">Operator</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-dark-400">Started</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-dark-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-200">
                    {activeOps.map((op, idx) => (
                      <tr key={idx} className="hover:bg-dark-100/50">
                        <td className="px-3 py-2 font-medium text-dark-700">{op.orderNumber || '-'}</td>
                        <td className="px-3 py-2 text-dark-500">{op.customer || '-'}</td>
                        <td className="px-3 py-2">
                          <OperationTypeBadge type={op.type} />
                        </td>
                        <td className="px-3 py-2 text-dark-500">{op.lines ?? '-'}</td>
                        <td className="px-3 py-2 text-dark-500">{op.operator || '-'}</td>
                        <td className="px-3 py-2 text-dark-500">{op.startTime ? new Date(op.startTime).toLocaleTimeString() : '-'}</td>
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
            <p className="text-center text-dark-400 text-sm py-6">No services configured</p>
          ) : (
            <div className="space-y-2">
              {services.map((svc) => (
                <div key={svc.name} className="flex items-center justify-between p-3 bg-dark-100/50 border border-dark-200 rounded-lg">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-dark-700">{svc.displayName || svc.name}</p>
                      <StatusBadge
                        status={svc.running || svc.status === 'Running' || svc.status === 'Active' ? 'success' : 'danger'}
                        label={svc.running || svc.status === 'Running' || svc.status === 'Active' ? 'Running' : 'Stopped'}
                        size="sm"
                      />
                    </div>
                    {svc.description && <p className="text-xs text-dark-400">{svc.description}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        defaultValue={svc.interval ? Math.round(svc.interval / 1000) : 5}
                        min={1}
                        max={3600}
                        className="w-16 px-2 py-1 bg-dark-100 border border-dark-200 rounded text-sm text-dark-600 text-center"
                        onBlur={(e) => {
                          const seconds = parseInt(e.target.value);
                          if (seconds >= 1 && seconds <= 3600) {
                            updateIntervalMut.mutate({ name: svc.name, interval: seconds * 1000 });
                          }
                        }}
                      />
                      <span className="text-xs text-dark-400">sec</span>
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={svc.enabled}
                        onChange={(e) => toggleServiceMut.mutate({ name: svc.name, enabled: e.target.checked })}
                        className="w-4 h-4 rounded border-dark-300 text-primary"
                      />
                      <span className="text-xs text-dark-400">Enabled</span>
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
            <p className="text-center text-dark-400 text-sm py-6">No configuration available</p>
          ) : (
            <div className="space-y-4">
              {groupConfigByCategory(config).map(([category, items]) => (
                <div key={category} className="rounded-lg border border-dark-200 overflow-hidden">
                  <div className="bg-dark-100/80 px-4 py-2.5 border-b border-dark-200">
                    <h4 className="text-xs font-semibold text-dark-500 uppercase tracking-wider">{category}</h4>
                  </div>
                  <div className="divide-y divide-dark-200">
                    {items.map(({ key, value }) => (
                      <div key={key} className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm text-dark-400">{key}</span>
                        <span className="text-sm text-dark-600 font-mono">{formatConfigValue(value)}</span>
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

function StatCard({ label, value, color }: { label: string; value: number; color: 'warning' | 'success' | 'muted' }) {
  const colorClass = color === 'warning' ? 'text-warning' : color === 'success' ? 'text-success' : 'text-dark-400';
  return (
    <div className="bg-dark-50 border border-dark-200 rounded-xl p-4">
      <div className="text-xs text-dark-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
    </div>
  );
}

function OperationTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    PICK: 'bg-amber-500/15 text-amber-500',
    PACK: 'bg-green-500/15 text-green-500',
    SHIP: 'bg-indigo-500/15 text-indigo-500',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[type] || 'bg-dark-200 text-dark-400'}`}>
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
