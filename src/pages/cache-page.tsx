import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  HardDrive,
  Database,
  Flame,
  Settings,
  Trash2,
  Search,
  Play,
  Square,
  Pause,
  RotateCcw,
  Zap,
  Save,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, Modal, Tabs, StatusBadge, LoadingSpinner } from '@/components/shared';
import type { TabItem } from '@/components/shared';
import type { CacheStats, CacheTtlConfig, WarmerStatus, WarmerTarget, ApiError } from '@/types';
import {
  getSmartCacheStats,
  getCacheTtlConfig,
  updateCacheTtlConfig,
  clearCache,
  getWarmerStatus,
  startWarmer,
  stopWarmer,
  pauseWarmer,
  resumeWarmer,
  triggerWarmer,
  warmTarget,
  saveWarmerConfig,
} from '@/services/admin-service';

// ===== Constants =====

const TTL_LABELS: Record<string, { label: string; description: string }> = {
  customers: { label: 'Customers', description: 'ArCustomer table' },
  suppliers: { label: 'Suppliers', description: 'ApSupplier table' },
  inventory: { label: 'Inventory', description: 'InvMaster table' },
  glAccounts: { label: 'GL Accounts', description: 'GenHistory table' },
  glMaster: { label: 'GL Master', description: 'GenMaster table' },
  purchaseOrders: { label: 'Purchase Orders', description: 'PorMasterHdr table' },
  salesOrders: { label: 'Sales Orders', description: 'SorMaster table' },
  poDetail: { label: 'PO Lines', description: 'PorMasterDetail table' },
  soDetail: { label: 'SO Lines', description: 'SorDetail table' },
  warehouse: { label: 'Warehouse', description: 'InvWarehouse table' },
  mrpRequirements: { label: 'MRP Requirements', description: 'MrpSctDet table' },
  mrpSuggestedPO: { label: 'MRP Suggested PO', description: 'Suggested purchase orders' },
  mrpSuggestedJob: { label: 'MRP Suggested Job', description: 'Suggested jobs' },
  mrpSchedule: { label: 'MRP Schedule', description: 'MrpSctHdr table' },
  profiles: { label: 'Profiles', description: 'Browse profiles config' },
  templates: { label: 'Templates', description: 'Business object templates' },
  inventorySummary: { label: 'Inventory Summary', description: 'Totals, qty by warehouse, stock value' },
  customersSummary: { label: 'Customers Summary', description: 'Count by class, credit exposure' },
  suppliersSummary: { label: 'Suppliers Summary', description: 'Count by class, on-hold status' },
  purchaseOrdersSummary: { label: 'PO Summary', description: 'Count by status, supplier, warehouse' },
  salesOrdersSummary: { label: 'SO Summary', description: 'Count by status, customer, branch' },
  glTrialBalance: { label: 'GL Trial Balance', description: 'Debits/credits by account type' },
};

const CATEGORY_LABELS: Record<string, string> = {
  masterData: 'Master Data',
  transactionData: 'Transaction Data',
  planningData: 'Planning Data',
  configData: 'Config Data',
  summaryData: 'Summary Data',
};

const tabs: TabItem[] = [
  { id: 'overview', label: 'Overview', icon: <HardDrive className="w-4 h-4" /> },
  { id: 'warmer', label: 'Smart Warmer', icon: <Flame className="w-4 h-4" /> },
  { id: 'operations', label: 'Cache Operations', icon: <Settings className="w-4 h-4" /> },
];

// ===== Helpers =====

function formatTTL(seconds: number): string {
  if (seconds === 0) return 'disabled';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

// ===== Sub-components =====

function StatCard({ label, value, subtext }: { label: string; value: string | number; subtext?: string }) {
  return (
    <div className="bg-dark-50 border border-dark-200 rounded-xl p-4">
      <p className="text-sm text-dark-400">{label}</p>
      <p className="text-2xl font-bold text-dark-700">{value}</p>
      {subtext && <p className="text-xs text-dark-400 mt-1">{subtext}</p>}
    </div>
  );
}

function WarmerTargetCard({
  target,
  onWarm,
  isWarming,
}: {
  target: WarmerTarget;
  onWarm: (name: string) => void;
  isWarming: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-dark-100/50 border border-dark-200 rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-dark-700">{target.name}</p>
        <p className="text-xs text-dark-400">{target.description}</p>
      </div>
      <div className="flex items-center gap-4 ml-4 text-xs text-dark-400">
        <span>TTL: {formatTTL(target.ttl)}</span>
        <span>Variants: {target.variants}</span>
        {target.stats && (
          <>
            <span className="text-success">{target.stats.warmed} warmed</span>
            {target.stats.failed > 0 && (
              <span className="text-danger">{target.stats.failed} failed</span>
            )}
          </>
        )}
        <Button
          variant="secondary"
          size="sm"
          icon={<Flame className="w-3 h-3" />}
          onClick={() => onWarm(target.name)}
          loading={isWarming}
        >
          Warm
        </Button>
      </div>
    </div>
  );
}

function TTLCategory({
  category,
  entries,
  values,
  onChange,
}: {
  category: string;
  entries: [string, number][];
  values: Record<string, number>;
  onChange: (key: string, val: number) => void;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-dark-600">{CATEGORY_LABELS[category] || category}</h3>
      {entries.map(([key]) => {
        const info = TTL_LABELS[key] || { label: key, description: '' };
        const value = values[key] ?? 0;
        return (
          <div key={key} className="flex items-center gap-3 p-3 bg-dark-100/50 border border-dark-200 rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-dark-700">{info.label}</p>
              <p className="text-xs text-dark-400">{info.description}</p>
            </div>
            <input
              type="number"
              min={0}
              max={86400}
              value={value}
              onChange={(e) => onChange(key, parseInt(e.target.value) || 0)}
              className="w-20 px-2 py-1.5 text-sm text-right bg-dark-100 border border-dark-200 rounded-lg text-dark-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <span className="text-xs text-dark-400 w-8">sec</span>
            <span className="text-xs text-dark-400 w-14 text-right">({formatTTL(value)})</span>
          </div>
        );
      })}
    </div>
  );
}

// ===== Main Component =====

export default function CachePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [clearPattern, setClearPattern] = useState('');
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [warmingTarget, setWarmingTarget] = useState<string | null>(null);
  const [editedTtls, setEditedTtls] = useState<CacheTtlConfig | null>(null);

  // ===== Queries =====

  const { data: cacheStats, isLoading: statsLoading } = useQuery<CacheStats>({
    queryKey: ['cache', 'stats'],
    queryFn: async () => {
      const data = await getSmartCacheStats();
      return data;
    },
    refetchInterval: 10000,
  });

  const { data: ttlConfigRaw } = useQuery<CacheTtlConfig>({
    queryKey: ['cache', 'ttl-config'],
    queryFn: async () => {
      const data = await getCacheTtlConfig();
      return data.config || data;
    },
  });

  const { data: warmerData, isLoading: warmerLoading } = useQuery<WarmerStatus>({
    queryKey: ['cache', 'warmer-status'],
    queryFn: async () => {
      const data = await getWarmerStatus();
      return data;
    },
    refetchInterval: 15000,
  });

  // Merge raw TTL config with local edits
  const ttlConfig = editedTtls || ttlConfigRaw || {};

  // ===== Mutations =====

  const clearCacheMutation = useMutation({
    mutationFn: (pattern?: string) => clearCache(pattern),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cache'] });
      toast.success('Cache cleared successfully');
      setClearPattern('');
      setShowClearAllModal(false);
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.error || 'Failed to clear cache');
    },
  });

  const startWarmerMutation = useMutation({
    mutationFn: startWarmer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cache', 'warmer-status'] });
      toast.success('Cache warmer started');
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.error || 'Failed to start warmer');
    },
  });

  const stopWarmerMutation = useMutation({
    mutationFn: stopWarmer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cache', 'warmer-status'] });
      toast.success('Cache warmer stopped');
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.error || 'Failed to stop warmer');
    },
  });

  const pauseWarmerMutation = useMutation({
    mutationFn: pauseWarmer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cache', 'warmer-status'] });
      toast.success('Cache warmer paused');
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.error || 'Failed to pause warmer');
    },
  });

  const resumeWarmerMutation = useMutation({
    mutationFn: resumeWarmer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cache', 'warmer-status'] });
      toast.success('Cache warmer resumed');
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.error || 'Failed to resume warmer');
    },
  });

  const triggerWarmerMutation = useMutation({
    mutationFn: triggerWarmer,
    onSuccess: () => {
      toast.success('Warming cycle triggered');
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['cache', 'warmer-status'] });
      }, 2000);
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.error || 'Failed to trigger warming cycle');
    },
  });

  const warmTargetMutation = useMutation({
    mutationFn: warmTarget,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cache', 'warmer-status'] });
      toast.success(`Target warmed in ${data.durationMs}ms`);
      setWarmingTarget(null);
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.error || 'Failed to warm target');
      setWarmingTarget(null);
    },
  });

  const saveTtlMutation = useMutation({
    mutationFn: (config: CacheTtlConfig) => updateCacheTtlConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cache', 'ttl-config'] });
      toast.success('TTL configuration saved');
      setEditedTtls(null);
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.error || 'Failed to save TTL configuration');
    },
  });

  const saveWarmerConfigMutation = useMutation({
    mutationFn: saveWarmerConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cache', 'warmer-status'] });
      toast.success('Warmer configuration saved');
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.error || 'Failed to save warmer configuration');
    },
  });

  // ===== Handlers =====

  const handleWarmTarget = (name: string) => {
    setWarmingTarget(name);
    warmTargetMutation.mutate(name);
  };

  const handleTtlChange = (category: string, key: string, value: number) => {
    setEditedTtls((prev) => {
      const current = prev || ttlConfigRaw || {};
      return {
        ...current,
        [category]: {
          ...(current as any)[category],
          [key]: value,
        },
      };
    });
  };

  const handleSaveTtls = () => {
    if (editedTtls) {
      saveTtlMutation.mutate(editedTtls);
    }
  };

  const handleSaveWarmerConfig = () => {
    if (!warmerData?.config) return;
    const intervalEl = document.getElementById('warmerInterval') as HTMLInputElement;
    const staggerEl = document.getElementById('warmerStagger') as HTMLInputElement;
    const thresholdEl = document.getElementById('warmerThreshold') as HTMLInputElement;
    saveWarmerConfigMutation.mutate({
      intervalMs: parseInt(intervalEl?.value) || warmerData.config.intervalMs,
      staggerDelayMs: parseInt(staggerEl?.value) || warmerData.config.staggerDelayMs,
      refreshThreshold: parseFloat(thresholdEl?.value) || warmerData.config.refreshThreshold,
    });
  };

  // ===== Derived values =====

  const hits = cacheStats?.totals?.hits ?? 0;
  const misses = cacheStats?.totals?.misses ?? 0;
  const hitRate = cacheStats?.totals?.hitRate ?? (hits + misses > 0 ? `${Math.round((hits / (hits + misses)) * 100)}%` : '0%');
  const localKeys = cacheStats?.local?.keys ?? 0;
  const redisAvailable = cacheStats?.redis?.available ?? false;

  const warmerState: 'running' | 'paused' | 'stopped' | 'disabled' =
    warmerData?.enabled === false
      ? 'disabled'
      : warmerData?.running && !warmerData?.paused
        ? 'running'
        : warmerData?.running && warmerData?.paused
          ? 'paused'
          : 'stopped';

  const warmerBadge: Record<string, { status: 'success' | 'warning' | 'neutral' | 'danger'; label: string }> = {
    running: { status: 'success', label: 'Running' },
    paused: { status: 'warning', label: 'Paused' },
    stopped: { status: 'neutral', label: 'Stopped' },
    disabled: { status: 'neutral', label: 'Disabled' },
  };

  // ===== Render =====

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <h1 className="text-lg font-semibold text-dark-700">Cache Management</h1>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="L1 Cache Keys" value={localKeys.toLocaleString()} />
            <StatCard label="Hit Rate" value={hitRate} />
            <StatCard label="Total Hits" value={(hits).toLocaleString()} />
            <StatCard label="Total Misses" value={(misses).toLocaleString()} />
          </div>

          {/* Redis Status */}
          <Card title="Redis / Valkey Connection">
            <div className="flex items-center gap-3">
              <StatusBadge
                status={redisAvailable ? 'success' : 'neutral'}
                label={redisAvailable ? 'Connected' : 'Offline'}
              />
              {cacheStats?.redis?.memory && (
                <span className="text-sm text-dark-400">Memory: {cacheStats.redis.memory}</span>
              )}
              {cacheStats?.redis?.keys !== undefined && (
                <span className="text-sm text-dark-400">Keys: {cacheStats.redis.keys.toLocaleString()}</span>
              )}
            </div>
          </Card>

          {/* TTL Configuration (read-only overview) */}
          <Card title="Current TTL Settings">
            <div className="space-y-4">
              {Object.entries(CATEGORY_LABELS).map(([category, label]) => {
                const entries = Object.entries((ttlConfig as any)[category] || {});
                if (entries.length === 0) return null;
                return (
                  <div key={category}>
                    <h4 className="text-xs font-semibold text-dark-500 uppercase tracking-wider mb-2">{label}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {entries.map(([key, val]) => {
                        const info = TTL_LABELS[key] || { label: key };
                        return (
                          <div key={key} className="flex items-center justify-between p-2 bg-dark-100/50 rounded-lg text-sm">
                            <span className="text-dark-600">{info.label}</span>
                            <span className="text-dark-400 font-mono">{formatTTL(val as number)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {ttlConfig.default !== undefined && (
                <div className="flex items-center gap-3 p-2 bg-dark-100/50 rounded-lg text-sm">
                  <span className="text-dark-600 font-medium">Default TTL</span>
                  <span className="text-dark-400 font-mono">{formatTTL(ttlConfig.default)}</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Tab: Smart Warmer */}
      {activeTab === 'warmer' && (
        <div className="space-y-6">
          {/* Warmer Status */}
          <Card
            title="Warmer Status"
            headerAction={<StatusBadge status={warmerBadge[warmerState].status} label={warmerBadge[warmerState].label} />}
          >
            {warmerLoading ? (
              <LoadingSpinner size="md" />
            ) : warmerState === 'disabled' ? (
              <p className="text-sm text-dark-400">Cache warmer is not enabled. Enable it via environment configuration.</p>
            ) : (
              <div className="space-y-4">
                {/* Controls */}
                <div className="flex items-center gap-2">
                  {warmerState === 'stopped' && (
                    <Button
                      size="sm"
                      icon={<Play className="w-3.5 h-3.5" />}
                      onClick={() => startWarmerMutation.mutate()}
                      loading={startWarmerMutation.isPending}
                    >
                      Start
                    </Button>
                  )}
                  {(warmerState === 'running' || warmerState === 'paused') && (
                    <Button
                      variant="danger"
                      size="sm"
                      icon={<Square className="w-3.5 h-3.5" />}
                      onClick={() => stopWarmerMutation.mutate()}
                      loading={stopWarmerMutation.isPending}
                    >
                      Stop
                    </Button>
                  )}
                  {warmerState === 'running' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Pause className="w-3.5 h-3.5" />}
                      onClick={() => pauseWarmerMutation.mutate()}
                      loading={pauseWarmerMutation.isPending}
                    >
                      Pause
                    </Button>
                  )}
                  {warmerState === 'paused' && (
                    <Button
                      size="sm"
                      icon={<Play className="w-3.5 h-3.5" />}
                      onClick={() => resumeWarmerMutation.mutate()}
                      loading={resumeWarmerMutation.isPending}
                    >
                      Resume
                    </Button>
                  )}
                  {warmerState !== 'stopped' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Zap className="w-3.5 h-3.5" />}
                      onClick={() => triggerWarmerMutation.mutate()}
                      loading={triggerWarmerMutation.isPending}
                    >
                      Trigger Now
                    </Button>
                  )}
                </div>

                {/* Timing info */}
                {warmerData?.lastRun && (
                  <p className="text-xs text-dark-400">Last run: {new Date(warmerData.lastRun).toLocaleString()}</p>
                )}
                {warmerData?.nextRun && (
                  <p className="text-xs text-dark-400">Next run: {new Date(warmerData.nextRun).toLocaleString()}</p>
                )}
              </div>
            )}
          </Card>

          {/* Warmer Configuration */}
          {warmerState !== 'disabled' && warmerData?.config && (
            <Card title="Warmer Configuration">
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-600 mb-1">Interval (ms)</label>
                    <input
                      id="warmerInterval"
                      type="number"
                      defaultValue={warmerData.config.intervalMs}
                      min={10000}
                      className="w-full px-3 py-2 bg-dark-100 border border-dark-200 rounded-lg text-sm text-dark-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <p className="text-xs text-dark-400 mt-1">{formatDuration(warmerData.config.intervalMs)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-600 mb-1">Stagger Delay (ms)</label>
                    <input
                      id="warmerStagger"
                      type="number"
                      defaultValue={warmerData.config.staggerDelayMs}
                      min={1000}
                      className="w-full px-3 py-2 bg-dark-100 border border-dark-200 rounded-lg text-sm text-dark-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <p className="text-xs text-dark-400 mt-1">{formatDuration(warmerData.config.staggerDelayMs)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-600 mb-1">Refresh Threshold</label>
                    <input
                      id="warmerThreshold"
                      type="number"
                      defaultValue={warmerData.config.refreshThreshold}
                      min={0}
                      max={1}
                      step={0.05}
                      className="w-full px-3 py-2 bg-dark-100 border border-dark-200 rounded-lg text-sm text-dark-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <p className="text-xs text-dark-400 mt-1">Refresh when {Math.round((warmerData.config.refreshThreshold) * 100)}% of TTL remains</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    icon={<Save className="w-3.5 h-3.5" />}
                    onClick={handleSaveWarmerConfig}
                    loading={saveWarmerConfigMutation.isPending}
                  >
                    Save Config
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Warming Targets */}
          {warmerState !== 'disabled' && (
            <Card title="Warming Targets">
              {warmerData?.targets && warmerData.targets.length > 0 ? (
                <div className="space-y-2">
                  {warmerData.targets.map((target) => (
                    <WarmerTargetCard
                      key={target.name}
                      target={target}
                      onWarm={handleWarmTarget}
                      isWarming={warmingTarget === target.name && warmTargetMutation.isPending}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-dark-400 text-center py-6">No warming targets configured</p>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Tab: Cache Operations */}
      {activeTab === 'operations' && (
        <div className="space-y-6">
          {/* Clear by Pattern */}
          <Card title="Clear Cache by Pattern">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                <input
                  type="text"
                  value={clearPattern}
                  onChange={(e) => setClearPattern(e.target.value)}
                  placeholder="Enter cache key pattern (e.g. customers:*)"
                  className="w-full pl-10 pr-3 py-2 bg-dark-100 border border-dark-200 rounded-lg text-sm text-dark-700 placeholder:text-dark-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <Button
                variant="secondary"
                icon={<Trash2 className="w-4 h-4" />}
                onClick={() => clearCacheMutation.mutate(clearPattern || undefined)}
                loading={clearCacheMutation.isPending}
                disabled={!clearPattern.trim()}
              >
                Clear Pattern
              </Button>
            </div>
          </Card>

          {/* Clear All */}
          <Card title="Clear All Cache">
            <div className="flex items-center justify-between">
              <p className="text-sm text-dark-400">
                Clear all cached data. This will force fresh data to be fetched from the ERP system.
              </p>
              <Button
                variant="danger"
                icon={<Trash2 className="w-4 h-4" />}
                onClick={() => setShowClearAllModal(true)}
              >
                Clear All Cache
              </Button>
            </div>
          </Card>

          {/* TTL Management */}
          <Card
            title="TTL Configuration"
            headerAction={
              editedTtls ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<RotateCcw className="w-3.5 h-3.5" />}
                    onClick={() => setEditedTtls(null)}
                  >
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    icon={<Save className="w-3.5 h-3.5" />}
                    onClick={handleSaveTtls}
                    loading={saveTtlMutation.isPending}
                  >
                    Save
                  </Button>
                </div>
              ) : undefined
            }
          >
            <div className="space-y-6">
              {Object.entries(CATEGORY_LABELS).map(([category]) => {
                const entries = Object.entries((ttlConfig as any)[category] || {}) as [string, number][];
                if (entries.length === 0) return null;
                return (
                  <TTLCategory
                    key={category}
                    category={category}
                    entries={entries}
                    values={(ttlConfig as any)[category] || {}}
                    onChange={(key, val) => handleTtlChange(category, key, val)}
                  />
                );
              })}
              {/* Default TTL */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-dark-600">Default</h3>
                <div className="flex items-center gap-3 p-3 bg-dark-100/50 border border-dark-200 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-dark-700">Default TTL</p>
                    <p className="text-xs text-dark-400">Applied to entities without specific TTL</p>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={86400}
                    value={ttlConfig.default ?? 300}
                    onChange={(e) =>
                      setEditedTtls((prev) => ({
                        ...(prev || ttlConfigRaw || {}),
                        default: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="w-20 px-2 py-1.5 text-sm text-right bg-dark-100 border border-dark-200 rounded-lg text-dark-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <span className="text-xs text-dark-400 w-8">sec</span>
                  <span className="text-xs text-dark-400 w-14 text-right">({formatTTL(ttlConfig.default ?? 300)})</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      <Modal
        isOpen={showClearAllModal}
        onClose={() => setShowClearAllModal(false)}
        title="Clear All Cache"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowClearAllModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => clearCacheMutation.mutate(undefined)}
              loading={clearCacheMutation.isPending}
            >
              Clear All
            </Button>
          </>
        }
      >
        <p className="text-sm text-dark-600">
          Are you sure you want to clear all cached data? This will force fresh data to be fetched from the ERP system on the next request.
        </p>
      </Modal>
    </div>
  );
}
