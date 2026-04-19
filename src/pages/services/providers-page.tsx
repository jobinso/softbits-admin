import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Mail, Star, Wifi, WifiOff, RefreshCw, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { DataTable, LoadingSpinner, StatusBadge, TableCard } from '@/components/shared';
import type { ColumnDef } from '@/components/shared';
import { getProvidersByApp, testProvider } from '@/services/admin-service';
import type { Provider } from '@/types';

export default function ProvidersPage() {
  const queryClient = useQueryClient();
  const [testingId, setTestingId] = useState<string | null>(null);

  const { data: providersData, isLoading } = useQuery({
    queryKey: ['admin', 'providers', 'by-app', 'BRIDGE'],
    queryFn: () => getProvidersByApp('BRIDGE'),
  });

  const providersList: Provider[] = (providersData?.data || []).filter(
    (p) => p.Category === 'EMAIL'
  );

  async function handleTestProvider(provider: Provider) {
    setTestingId(provider.ProviderId);
    try {
      const result = await testProvider(provider.ProviderId);
      if (result.ok) {
        toast.success(result.message || 'Connection successful');
      } else {
        toast.error(result.message || 'Connection failed');
      }
      queryClient.invalidateQueries({ queryKey: ['admin', 'providers'] });
    } catch {
      toast.error('Connection test failed');
    } finally {
      setTestingId(null);
    }
  }

  const providerColumns: ColumnDef<Provider>[] = [
    {
      key: 'Name', label: 'Name', sortable: true, filterable: true,
      render: (val, row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-semantic-text-default">{val}</span>
          {row.IsDefault && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />}
        </div>
      ),
    },
    {
      key: 'ProviderTypeCode', label: 'Type', width: 160, sortable: true,
      render: (_val, row) => (
        <span className="text-semantic-text-faint">{row.TypeDisplayName || row.ProviderTypeCode}</span>
      ),
    },
    {
      key: 'IsActive', label: 'Status', width: 100,
      render: (val) => <StatusBadge status={val ? 'success' : 'danger'} label={val ? 'Active' : 'Inactive'} size="sm" />,
    },
    {
      key: 'LastTestStatus', label: 'Health', width: 110,
      render: (val, row) => {
        if (!val) return <span className="text-semantic-text-faint text-xs">Not tested</span>;
        const statusMap: Record<string, 'success' | 'warning' | 'danger'> = { ok: 'success', warning: 'warning', error: 'danger' };
        return (
          <span title={row.LastTestError || undefined}>
            <StatusBadge status={statusMap[val] || 'danger'} label={val === 'ok' ? 'OK' : val === 'warning' ? 'Warning' : 'Failed'} size="sm" />
          </span>
        );
      },
    },
    {
      key: 'Configuration', label: 'Config', width: 180,
      render: (val) => {
        if (!val || typeof val !== 'object') return <span className="text-semantic-text-faint">-</span>;
        const keys = Object.keys(val);
        if (keys.length === 0) return <span className="text-semantic-text-faint">-</span>;
        const summary = keys.slice(0, 3).join(', ') + (keys.length > 3 ? ` (+${keys.length - 3})` : '');
        return <span className="text-xs text-semantic-text-faint" title={JSON.stringify(val, null, 2)}>{summary}</span>;
      },
    },
    {
      key: 'LastTestedAt', label: 'Last Tested', width: 140,
      render: (val) => <span className="text-xs text-semantic-text-faint">{val ? new Date(val).toLocaleString() : '-'}</span>,
    },
    {
      key: 'ProviderId', label: 'Actions', width: 80, sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => handleTestProvider(row)}
            disabled={testingId === row.ProviderId}
            className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover transition-colors disabled:opacity-50"
            title="Test Connection"
          >
            {testingId === row.ProviderId ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : row.LastTestStatus === 'ok' ? (
              <Wifi className="w-4 h-4" />
            ) : (
              <WifiOff className="w-4 h-4" />
            )}
          </button>
        </div>
      ),
    },
  ];

  return (
    <TableCard
      title="Email Providers"
      icon={<Mail className="w-4 h-4" />}
      count={providersList.length}
      headerActions={
        <Link
          to="/providers"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary hover:text-primary-600 border border-primary/30 hover:border-primary rounded-lg transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Manage Providers
        </Link>
      }
    >
      {isLoading ? <LoadingSpinner size="lg" /> : (
        <DataTable<Provider>
          id="admin-security-email-providers"
          columns={providerColumns}
          data={providersList}
          rowKey="ProviderId"
          emptyMessage="No email providers configured"
          emptyIcon={Mail}
          embedded
          showColumnPicker={false}
        />
      )}
    </TableCard>
  );
}
