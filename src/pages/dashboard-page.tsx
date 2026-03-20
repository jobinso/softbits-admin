import { useQuery } from '@tanstack/react-query';
import { Database, HardDrive, Cpu, Users, Smartphone, Key, Layers } from 'lucide-react';
import { LoadingSpinner, PageHeader } from '@/components/shared';
import { StatusCard, AppServiceTable } from '@/components/dashboard';
import { getUsers, getDevices, getTokens, getHealth } from '@/services/admin-service';
import type { AppStatus, SystemHealth } from '@/types';

interface HealthResponse {
  status: string;
  uptime: number;
  version?: string;
  apps?: Record<string, { enabled: boolean; name: string; connected: boolean }>;
  syspro?: {
    status: string;
    pool?: {
      totalSessions: number;
      availableSessions: number;
      activeSessions: number;
    };
  };
  cache?: {
    enabled?: boolean;
    connected?: boolean;
    hits?: number;
    misses?: number;
    keys?: number;
  };
  database?: {
    connected: boolean;
  };
}

function deriveSystemHealth(health: HealthResponse): SystemHealth {
  const apps: Record<string, AppStatus> = {};
  if (health.apps) {
    for (const [key, app] of Object.entries(health.apps)) {
      apps[key] = {
        name: app.name,
        enabled: app.enabled,
        healthy: app.connected,
      };
    }
  }

  return {
    status: health.status,
    uptime: health.uptime,
    version: health.version || 'unknown',
    erp: health.syspro
      ? { type: 'SYSPRO', connected: health.syspro.status === 'connected' }
      : undefined,
    database: health.database,
    cache: health.cache
      ? { enabled: health.cache.enabled ?? false, connected: health.cache.connected ?? false }
      : undefined,
    apps,
  };
}

export default function DashboardPage() {
  // Fetch health data via rawApi (includes auth token)
  const { data: healthRaw, isLoading: healthLoading } = useQuery<HealthResponse>({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await getHealth();
      return res as unknown as HealthResponse;
    },
    refetchInterval: 30000,
  });

  // Fetch user count
  const { data: usersData } = useQuery<{ count: number }>({
    queryKey: ['admin', 'users-count'],
    queryFn: async () => {
      const res = await getUsers();
      return { count: res.count ?? res.users?.length ?? 0 };
    },
    refetchInterval: 30000,
  });

  // Fetch device count
  const { data: devicesData } = useQuery<{ count: number }>({
    queryKey: ['admin', 'devices-count'],
    queryFn: async () => {
      const res = await getDevices();
      return { count: res.count ?? res.data?.length ?? 0 };
    },
    refetchInterval: 30000,
  });

  // Fetch token count
  const { data: tokensData } = useQuery<{ count: number }>({
    queryKey: ['admin', 'tokens-count'],
    queryFn: async () => {
      const res = await getTokens();
      return { count: res.count ?? res.tokens?.length ?? 0 };
    },
    refetchInterval: 30000,
  });

  if (healthLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const health = healthRaw ? deriveSystemHealth(healthRaw) : null;
  const cacheKeys = healthRaw?.cache?.keys ?? 0;
  const cacheHitRate =
    healthRaw?.cache?.hits !== undefined && healthRaw?.cache?.misses !== undefined
      ? Math.round(
          (healthRaw.cache.hits / (healthRaw.cache.hits + healthRaw.cache.misses || 1)) * 100
        )
      : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="System health overview and service status" />

      {/* Section 1: System Status Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatusCard
          title="ERP"
          icon={Cpu}
          status={health?.erp?.connected ? 'healthy' : health?.erp ? 'down' : 'unknown'}
          items={[
            { label: 'Type', value: health?.erp?.type ?? '-' },
            { label: 'Connection', value: health?.erp?.connected ? 'Connected' : 'Disconnected' },
          ]}
        />
        <StatusCard
          title="Database"
          icon={Database}
          status={health?.database?.connected ? 'healthy' : health?.database ? 'down' : 'unknown'}
          items={[
            {
              label: 'Connection',
              value: health?.database?.connected ? 'Connected' : 'Disconnected',
            },
          ]}
        />
        <StatusCard
          title="Cache"
          icon={HardDrive}
          status={
            health?.cache?.enabled
              ? 'healthy'
              : 'unknown'
          }
          items={[
            {
              label: 'Status',
              value: health?.cache?.enabled
                ? health.cache.connected
                  ? 'L1 + Redis'
                  : 'L1 (NodeCache)'
                : 'Disabled',
            },
            ...(cacheHitRate !== null
              ? [{ label: 'Hit Rate', value: `${cacheHitRate}%` }]
              : []),
          ]}
        />
      </div>

      {/* Section 2: App Service Status Table */}
      {health?.apps ? (
        <AppServiceTable apps={health.apps} uptime={health.uptime} />
      ) : (
        <div>
          <h2 className="text-lg font-semibold text-semantic-text-default mb-4">App Services</h2>
          <p className="text-sm text-semantic-text-subtle">No app data available.</p>
        </div>
      )}

      {/* Section 3: Quick Stats Row */}
      <div>
        <h2 className="text-lg font-semibold text-semantic-text-default mb-4">Quick Stats</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickStatCard
            icon={Users}
            label="Users"
            value={usersData?.count}
          />
          <QuickStatCard
            icon={Smartphone}
            label="Devices"
            value={devicesData?.count}
          />
          <QuickStatCard
            icon={Key}
            label="Tokens"
            value={tokensData?.count}
          />
          <QuickStatCard
            icon={Layers}
            label="Cache Entries"
            value={cacheKeys}
          />
        </div>
      </div>
    </div>
  );
}

function QuickStatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value?: number;
}) {
  return (
    <div className="bg-surface-raised border border-border rounded-xl p-4 flex items-center gap-3">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-surface-overlay">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div>
        <p className="text-2xl font-bold text-semantic-text-default">
          {value !== undefined ? value.toLocaleString() : '-'}
        </p>
        <p className="text-xs text-semantic-text-subtle">{label}</p>
      </div>
    </div>
  );
}
