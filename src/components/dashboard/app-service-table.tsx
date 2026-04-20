import { Monitor, Clock } from 'lucide-react';
import { DataTable, TableCard, StatusBadge } from '@/components/shared';
import type { ColumnDef } from '@/components/shared';
import type { AppStatus } from '@/types';

// ===== Static metadata per app key =====

const APP_METADATA: Record<string, { port: number; description: string }> = {
  flip:      { port: 4580, description: 'Point of Sale' },
  connect:   { port: 4280, description: 'CRM & Customer Management' },
  stack:     { port: 4680, description: 'Warehouse Management' },
  floor:     { port: 4880, description: 'Shop Floor Labor' },
  shop:      { port: 9000, description: 'E-commerce & Ordering' },
  infuse:    { port: 3900, description: 'AI Integration (MCP)' },
  infuseApp: { port: 3910, description: 'AI Integration (App)' },
  work:      { port: 3990, description: 'Workflow Automation' },
  pulp:      { port: 4380, description: 'Document Management' },
  cast:      { port: 4480, description: 'Sales & Inventory Forecasting' },
};

// ===== Types =====

interface AppServiceRow {
  key: string;
  name: string;
  healthy: boolean;
  port: number;
  description: string;
}

export interface AppServiceTableProps {
  apps: Record<string, AppStatus>;
  uptime?: number;
}

// ===== Helpers =====

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatStartTime(uptimeSeconds: number): string {
  const startDate = new Date(Date.now() - uptimeSeconds * 1000);
  return startDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ===== Column Definitions =====

const columns: ColumnDef<AppServiceRow>[] = [
  {
    key: 'name',
    label: 'Service',
    width: 180,
    sortable: true,
    render: (value: string) => (
      <span className="font-medium text-semantic-text-default">{value}</span>
    ),
  },
  {
    key: 'key',
    label: 'Code',
    width: 100,
    sortable: true,
    render: (value: string) => (
      <span className="font-mono text-xs text-semantic-text-subtle">{value}</span>
    ),
  },
  {
    key: 'healthy',
    label: 'Status',
    width: 120,
    sortable: true,
    render: (value: boolean) => (
      <StatusBadge
        status={value ? 'success' : 'danger'}
        label={value ? 'Healthy' : 'Unhealthy'}
        size="sm"
      />
    ),
  },
  {
    key: 'port',
    label: 'Port',
    width: 80,
    sortable: false,
    align: 'right' as const,
    render: (value: number) => (
      <span className="font-mono text-xs tabular-nums">{value || '-'}</span>
    ),
  },
  {
    key: 'description',
    label: 'Description',
    sortable: false,
    render: (value: string) => (
      <span className="text-semantic-text-subtle">{value}</span>
    ),
  },
];

// ===== Component =====

export function AppServiceTable({ apps, uptime }: AppServiceTableProps) {
  const enabledApps = Object.entries(apps).filter(([, app]) => app.enabled);

  const rows: AppServiceRow[] = enabledApps.map(([key, app]) => {
    const meta = APP_METADATA[key] || { port: 0, description: 'Unknown service' };
    return {
      key,
      name: app.name || key,
      healthy: app.healthy,
      port: meta.port,
      description: meta.description,
    };
  });

  return (
    <TableCard
      title="App Services"
      icon={<Monitor className="w-4 h-4" />}
      count={rows.length}
      headerActions={
        uptime !== undefined ? (
          <div className="flex items-center gap-1.5 text-xs text-semantic-text-subtle">
            <Clock className="w-3.5 h-3.5" />
            <span>Up {formatUptime(uptime)} &mdash; since {formatStartTime(uptime)}</span>
          </div>
        ) : undefined
      }
    >
      <DataTable
        id="app-services"
        columns={columns}
        data={rows}
        rowKey="key"
        pageSize={10}
        embedded
        showColumnPicker={false}
        persistPreferences={false}
      />
    </TableCard>
  );
}
