import { useState, useMemo, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  FileText,
  Cog,
  Server,
  Download,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, Tabs, StatusBadge, LoadingSpinner, PageHeader } from '@/components/shared';
import type { TabItem } from '@/components/shared';
import type { ServiceInfo, DevTask, ApiError } from '@/types';
import {
  getServices,
  updateService,
  getServiceLogs,
  clearServiceLogs,
  getDevTasks,
  executeDevTask,
} from '@/services/admin-service';

// ===== Constants =====

const SERVICE_NAMES: Record<string, string> = {
  'softbits-bridge': 'SoftBITS Bridge',
  'softbits-valkey': 'SoftBITS Valkey',
  'softbits-connect': 'SoftBITS Connect',
  'connect-sync': 'Connect Sync Engine',
  'softbits-flip': 'SoftBITS Flip',
  'softbits-stack': 'SoftBITS Stack',
  'softbits-shop': 'SoftBITS Shop',
  'softbits-floor': 'SoftBITS Floor',
  'softbits-cast': 'SoftBITS Cast',
  'infuse-mcp': 'Infuse MCP',
  'infuse-http': 'Infuse HTTP',
  'infuse-work': 'Infuse Work',
};

const APP_SERVICES = [
  { key: 'flip', name: 'FlipIT', description: 'Mobile Point of Sale for truck sales', envVar: 'SOFTBITS_FLIP_ENABLED' },
  { key: 'connect', name: 'ConnectIT', description: 'CRM synchronization and integration', envVar: 'SOFTBITS_CONNECT_ENABLED' },
  { key: 'stack', name: 'StackIT', description: 'Warehouse Management System', envVar: 'SOFTBITS_STACK_ENABLED' },
  { key: 'floor', name: 'FloorIT', description: 'Shop Floor Labor Capture', envVar: 'SOFTBITS_FLOOR_ENABLED' },
  { key: 'infuse', name: 'InfuseIT - MCP', description: 'AI/MCP integration services', envVar: 'SOFTBITS_INFUSE_ENABLED' },
  { key: 'forecast', name: 'CastIT', description: 'Sales & Inventory Forecasting', envVar: 'SOFTBITS_FORECAST_ENABLED' },
];

const LOG_SERVICES = [
  { value: 'softbits-bridge', label: 'Bridge' },
  { value: 'cache-warmer', label: 'Cache Warmer' },
  { value: 'softbits-valkey', label: 'Valkey' },
  { value: 'softbits-connect', label: 'Connect' },
  { value: 'connect-sync', label: 'Connect Sync' },
  { value: 'softbits-flip', label: 'Flip' },
  { value: 'softbits-stack', label: 'Stack' },
  { value: 'softbits-shop', label: 'Shop' },
  { value: 'softbits-floor', label: 'Floor' },
  { value: 'softbits-cast', label: 'Cast' },
  { value: 'infuse-mcp', label: 'Infuse MCP' },
  { value: 'infuse-http', label: 'Infuse HTTP' },
  { value: 'infuse-work', label: 'Infuse Work' },
];

const tabs: TabItem[] = [
  { id: 'health', label: 'Health', icon: <Activity className="w-4 h-4" /> },
  { id: 'logs', label: 'Logs', icon: <FileText className="w-4 h-4" /> },
  { id: 'tasks', label: 'Tasks', icon: <Cog className="w-4 h-4" /> },
];

// ===== Helpers =====

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getLogLineColor(line: string): string {
  const lower = line.toLowerCase();
  if (lower.includes('error') || lower.includes('"level":"error"')) return 'text-danger';
  if (lower.includes('warn') || lower.includes('"level":"warn"')) return 'text-warning';
  if (lower.includes('info') || lower.includes('"level":"info"')) return 'text-info';
  if (lower.includes('debug') || lower.includes('"level":"debug"')) return 'text-dark-400';
  return 'text-dark-600';
}

// ===== Sub-components =====

function HealthCard({
  title,
  status,
  items,
}: {
  title: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  items: { label: string; value: string }[];
}) {
  const badge: Record<string, { status: 'success' | 'warning' | 'danger' | 'neutral'; label: string }> = {
    healthy: { status: 'success', label: 'Healthy' },
    degraded: { status: 'warning', label: 'Degraded' },
    down: { status: 'danger', label: 'Down' },
    unknown: { status: 'neutral', label: 'Unknown' },
  };

  return (
    <div className="bg-dark-50 border border-dark-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-dark-500" />
          <h3 className="text-sm font-semibold text-dark-700">{title}</h3>
        </div>
        <StatusBadge status={badge[status].status} label={badge[status].label} size="sm" />
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between text-sm">
            <span className="text-dark-400">{item.label}</span>
            <span className="text-dark-600 font-medium">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ServiceToggle({
  service,
  enabled,
  onToggle,
  toggling,
}: {
  service: { key: string; name: string; description: string; envVar: string };
  enabled: boolean;
  onToggle: (key: string, enabled: boolean) => void;
  toggling: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-dark-100/50 border border-dark-200 rounded-lg">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-dark-700">{service.name}</p>
          <StatusBadge status={enabled ? 'success' : 'neutral'} label={enabled ? 'Enabled' : 'Disabled'} size="sm" />
        </div>
        <p className="text-xs text-dark-400">{service.description}</p>
        <p className="text-xs text-dark-400 font-mono">{service.envVar}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(service.key, e.target.checked)}
          disabled={toggling}
          className="sr-only peer"
        />
        <div className="w-9 h-5 bg-dark-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
      </label>
    </div>
  );
}

function DevTaskCard({
  task,
  onRun,
  running,
}: {
  task: DevTask;
  onRun: (taskId: string) => void;
  running: boolean;
}) {
  return (
    <div
      className="bg-dark-100/50 border border-dark-200 rounded-lg p-3.5 hover:border-primary/50 transition-colors cursor-pointer"
      onClick={() => !running && onRun(task.id)}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-dark-700">
          {task.icon} {task.name}
        </span>
        {running && (
          <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
        )}
      </div>
      <p className="text-xs text-dark-400 leading-relaxed">{task.description}</p>
    </div>
  );
}

// ===== Main Component =====

export default function ServicesPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('health');

  // Log viewer state
  const [logService, setLogService] = useState('');
  const [logLines, setLogLines] = useState('100');
  const [logFilter, setLogFilter] = useState('');
  const [logLevelFilter, setLogLevelFilter] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Dev tasks state
  const [runningTask, setRunningTask] = useState<string | null>(null);
  const [taskOutput, setTaskOutput] = useState<{ id: string; output: string; success: boolean; duration: number } | null>(null);

  // ===== Queries =====

  const { data: healthRaw, isLoading: healthLoading } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await fetch('/health');
      if (!res.ok) throw new Error('Health check failed');
      return res.json();
    },
    refetchInterval: 15000,
  });

  const { data: servicesData } = useQuery({
    queryKey: ['admin', 'services'],
    queryFn: getServices,
  });

  const { data: logsData, refetch: refetchLogs } = useQuery({
    queryKey: ['admin', 'logs', logService, logLines],
    queryFn: () => getServiceLogs(logService, { limit: parseInt(logLines) }),
    enabled: !!logService,
  });

  const { data: devTasksData } = useQuery({
    queryKey: ['admin', 'dev-tasks'],
    queryFn: getDevTasks,
    enabled: activeTab === 'tasks',
  });

  // ===== Mutations =====

  const toggleServiceMutation = useMutation({
    mutationFn: ({ name, enabled }: { name: string; enabled: boolean }) => updateService(name, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'services'] });
      queryClient.invalidateQueries({ queryKey: ['health'] });
      toast.success('Service updated');
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.error || 'Failed to update service');
      queryClient.invalidateQueries({ queryKey: ['admin', 'services'] });
    },
  });

  const clearLogsMutation = useMutation({
    mutationFn: clearServiceLogs,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'logs'] });
      toast.success('Logs cleared');
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.error || 'Failed to clear logs');
    },
  });

  const executeTaskMutation = useMutation({
    mutationFn: executeDevTask,
    onSuccess: (data) => {
      setTaskOutput({
        id: runningTask || '',
        output: data.output || '(no output)',
        success: data.success,
        duration: data.duration,
      });
      setRunningTask(null);
    },
    onError: (error: ApiError) => {
      setTaskOutput({
        id: runningTask || '',
        output: `Error: ${error.response?.data?.error || error.message}`,
        success: false,
        duration: 0,
      });
      setRunningTask(null);
    },
  });

  // ===== Handlers =====

  const handleToggleService = (name: string, enabled: boolean) => {
    toggleServiceMutation.mutate({ name, enabled });
  };

  const handleLoadLogs = () => {
    if (logService) refetchLogs();
  };

  const handleAutoRefresh = useCallback((checked: boolean) => {
    setAutoRefresh(checked);
    if (checked) {
      refetchLogs();
      autoRefreshRef.current = setInterval(() => refetchLogs(), 5000);
    } else {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    }
  }, [refetchLogs]);

  const handleExportLogs = () => {
    const content = logsData?.content;
    if (!content || !logService) {
      toast.error('Please load logs first');
      return;
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `${logService}_logs_${timestamp}.log`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success(`Exported as ${filename}`);
  };

  const handleRunTask = (taskId: string) => {
    const task = groupedTasks.flatMap(([, tasks]) => tasks).find((t) => t.id === taskId);
    if (task?.confirm && !window.confirm(`Are you sure you want to run "${taskId}"?`)) return;
    setRunningTask(taskId);
    setTaskOutput(null);
    executeTaskMutation.mutate(taskId);
  };

  // ===== Derived =====

  const health = healthRaw;
  const bridgeStatus = health?.status === 'ok' ? 'healthy' : health?.status === 'degraded' ? 'degraded' : health ? 'down' : 'unknown';
  const erpStatus = health?.syspro?.status === 'connected' ? 'healthy' : health?.syspro ? 'down' : 'unknown';
  const dbStatus = health?.database?.connected ? 'healthy' : health?.database ? 'down' : 'unknown';
  const cacheStatus = health?.cache?.connected ? 'healthy' : health?.cache?.enabled ? 'down' : 'unknown';

  const cacheHits = health?.cache?.hits ?? 0;
  const cacheMisses = health?.cache?.misses ?? 0;
  const cacheHitRate = cacheHits + cacheMisses > 0
    ? `${Math.round((cacheHits / (cacheHits + cacheMisses)) * 100)}%`
    : '-';

  const appStatuses: Record<string, boolean> = {};
  if (health?.apps) {
    for (const [key, app] of Object.entries(health.apps)) {
      appStatuses[key] = (app as any).enabled === true;
    }
  }

  // Services list from API
  const apiServices: Record<string, ServiceInfo> = servicesData?.services || {};

  // Filter/highlight logs
  const logContent: string = logsData?.content || '';
  const filteredLogLines = useMemo(() => {
    if (!logContent) return [];
    let lines = logContent.split('\n');
    if (logFilter) {
      const lower = logFilter.toLowerCase();
      lines = lines.filter((line: string) => line.toLowerCase().includes(lower));
    }
    if (logLevelFilter) {
      lines = lines.filter((line: string) => {
        const lineLower = line.toLowerCase();
        switch (logLevelFilter) {
          case 'error':
            return lineLower.includes('"level":"error"') || lineLower.includes('[error]') || lineLower.includes('error:');
          case 'warn':
            return lineLower.includes('"level":"warn"') || lineLower.includes('[warn]') || lineLower.includes('warning:');
          case 'info':
            return lineLower.includes('"level":"info"') || lineLower.includes('[info]');
          case 'debug':
            return lineLower.includes('"level":"debug"') || lineLower.includes('[debug]');
          default:
            return true;
        }
      });
    }
    return lines;
  }, [logContent, logFilter, logLevelFilter]);

  // Group dev tasks
  const groupedTasks: [string, DevTask[]][] = useMemo(() => {
    const tasks: DevTask[] = devTasksData?.tasks || [];
    const groups: Record<string, DevTask[]> = {};
    for (const task of tasks) {
      if (!groups[task.group]) groups[task.group] = [];
      groups[task.group].push(task);
    }
    return Object.entries(groups);
  }, [devTasksData]);

  // ===== Render =====

  if (healthLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Services"
        description="Monitor service health, view logs, and run maintenance tasks"
        icon={<Server className="w-5 h-5" />}
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab: Health */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          {/* System Health Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <HealthCard
              title="Bridge"
              status={bridgeStatus as any}
              items={[
                { label: 'Status', value: health?.status ?? 'unknown' },
                { label: 'Uptime', value: health?.uptime ? formatUptime(health.uptime) : '-' },
                { label: 'Version', value: health?.version ?? '-' },
              ]}
            />
            <HealthCard
              title="ERP (SYSPRO)"
              status={erpStatus as any}
              items={[
                { label: 'Connection', value: health?.syspro?.status === 'connected' ? 'Connected' : 'Disconnected' },
                ...(health?.syspro?.pool
                  ? [{ label: 'Sessions', value: `${health.syspro.pool.activeSessions || 0}/${health.syspro.pool.totalSessions || 0}` }]
                  : []),
              ]}
            />
            <HealthCard
              title="Database"
              status={dbStatus as any}
              items={[
                { label: 'Connection', value: health?.database?.connected ? 'Connected' : 'Disconnected' },
              ]}
            />
            <HealthCard
              title="Cache"
              status={cacheStatus as any}
              items={[
                { label: 'Status', value: health?.cache?.connected ? 'Connected' : health?.cache?.enabled ? 'Disconnected' : 'Disabled' },
                { label: 'Keys', value: String(health?.cache?.keys ?? 0) },
                { label: 'Hit Rate', value: cacheHitRate },
              ]}
            />
          </div>

          {/* App Services */}
          <Card title="App Services">
            <div className="space-y-2">
              {APP_SERVICES.map((svc) => (
                <ServiceToggle
                  key={svc.key}
                  service={svc}
                  enabled={appStatuses[svc.key] ?? false}
                  onToggle={handleToggleService}
                  toggling={toggleServiceMutation.isPending}
                />
              ))}
            </div>
          </Card>

          {/* API Services */}
          {Object.keys(apiServices).length > 0 && (
            <Card title="API Services">
              <div className="space-y-2">
                {Object.entries(apiServices).map(([key, svc]) => (
                  <div key={key} className="flex items-center justify-between p-3 bg-dark-100/50 border border-dark-200 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-dark-700">{svc.name}</p>
                      <p className="text-xs text-dark-400">{svc.description}</p>
                    </div>
                    <StatusBadge
                      status={svc.enabled ? 'success' : 'neutral'}
                      label={svc.enabled ? 'Enabled' : 'Disabled'}
                      size="sm"
                    />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Tab: Logs */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Log Controls */}
          <Card>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={logService}
                onChange={(e) => setLogService(e.target.value)}
                className="px-3 py-2 bg-dark-100 border border-dark-200 rounded-lg text-sm text-dark-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">Select service...</option>
                {LOG_SERVICES.map((svc) => (
                  <option key={svc.value} value={svc.value}>{svc.label}</option>
                ))}
              </select>
              <select
                value={logLines}
                onChange={(e) => setLogLines(e.target.value)}
                className="px-3 py-2 bg-dark-100 border border-dark-200 rounded-lg text-sm text-dark-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="50">50 lines</option>
                <option value="100">100 lines</option>
                <option value="200">200 lines</option>
                <option value="500">500 lines</option>
              </select>
              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                onClick={handleLoadLogs}
                disabled={!logService}
              >
                Load
              </Button>
              <label className="flex items-center gap-2 text-sm text-dark-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => handleAutoRefresh(e.target.checked)}
                  className="rounded border-dark-300 bg-dark-200 text-primary focus:ring-primary/50"
                />
                Auto-refresh
              </label>
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="sm"
                icon={<Download className="w-3.5 h-3.5" />}
                onClick={handleExportLogs}
                disabled={!logContent}
              >
                Export
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 className="w-3.5 h-3.5 text-danger" />}
                onClick={() => {
                  if (logService && window.confirm(`Clear all logs for ${SERVICE_NAMES[logService] || logService}?`)) {
                    clearLogsMutation.mutate(logService);
                  }
                }}
                disabled={!logService}
              >
                Clear
              </Button>
            </div>
          </Card>

          {/* Filter Bar */}
          {logContent && (
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                placeholder="Filter logs..."
                className="flex-1 px-3 py-2 bg-dark-100 border border-dark-200 rounded-lg text-sm text-dark-700 placeholder:text-dark-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <select
                value={logLevelFilter}
                onChange={(e) => setLogLevelFilter(e.target.value)}
                className="px-3 py-2 bg-dark-100 border border-dark-200 rounded-lg text-sm text-dark-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">All Levels</option>
                <option value="error">Error</option>
                <option value="warn">Warn</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
              </select>
              <span className="text-xs text-dark-400">
                {filteredLogLines.length} {logFilter || logLevelFilter ? `of ${logContent.split('\n').length}` : ''} lines
              </span>
            </div>
          )}

          {/* Log Content */}
          {logContent ? (
            <div className="bg-dark-50 border border-dark-200 rounded-xl overflow-hidden">
              <div className="overflow-auto max-h-[500px] p-4 font-mono text-xs leading-relaxed">
                {filteredLogLines.map((line, idx) => (
                  <div key={idx} className={getLogLineColor(line)}>
                    {line}
                  </div>
                ))}
                {filteredLogLines.length === 0 && (
                  <p className="text-dark-400">No matching log entries</p>
                )}
              </div>
            </div>
          ) : logService ? (
            <div className="text-center py-12 text-sm text-dark-400">
              Click Load to view logs for {SERVICE_NAMES[logService] || logService}
            </div>
          ) : (
            <div className="text-center py-12 text-sm text-dark-400">
              Select a service to view its logs
            </div>
          )}
        </div>
      )}

      {/* Tab: Tasks */}
      {activeTab === 'tasks' && (
        <div className="space-y-6">
          {groupedTasks.length === 0 ? (
            <div className="text-center py-12 text-sm text-dark-400">
              {devTasksData ? 'No tasks available' : <LoadingSpinner size="md" />}
            </div>
          ) : (
            groupedTasks.map(([group, tasks]) => (
              <Card key={group} title={group}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {tasks.map((task) => (
                    <DevTaskCard
                      key={task.id}
                      task={task}
                      onRun={handleRunTask}
                      running={runningTask === task.id}
                    />
                  ))}
                </div>
              </Card>
            ))
          )}

          {/* Task Output Panel */}
          {taskOutput && (
            <Card
              title={`$ ${taskOutput.id}`}
              headerAction={
                <div className="flex items-center gap-3">
                  {taskOutput.duration > 0 && (
                    <span className="text-xs text-dark-400">{(taskOutput.duration / 1000).toFixed(1)}s</span>
                  )}
                  <StatusBadge
                    status={taskOutput.success ? 'success' : 'danger'}
                    label={taskOutput.success ? 'Success' : 'Failed'}
                    size="sm"
                  />
                </div>
              }
            >
              <pre className="bg-dark-100 rounded-lg p-4 text-xs text-dark-600 font-mono overflow-auto max-h-[300px] whitespace-pre-wrap">
                {taskOutput.output}
              </pre>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
