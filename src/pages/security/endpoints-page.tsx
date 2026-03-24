import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Globe, Search, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DataTable,
  Button,
  LoadingSpinner,
  TableCard,
} from '@/components/shared';
import type { ColumnDef } from '@/components/shared';
import { getEndpoints, getEndpointGroups, discoverEndpoints } from '@/services/admin-service';
import type { ApiEndpoint, EndpointGroup } from '@/types';

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-blue-500/20 text-blue-400',
  POST: 'bg-green-500/20 text-green-400',
  PUT: 'bg-yellow-500/20 text-yellow-400',
  DELETE: 'bg-red-500/20 text-red-400',
};

export default function EndpointsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');

  const { data: endpointsResponse, isLoading } = useQuery({
    queryKey: ['admin', 'endpoints', { entity: entityFilter || undefined, group: groupFilter || undefined }],
    queryFn: () => getEndpoints({ entity: entityFilter || undefined, group: groupFilter || undefined }),
  });

  const { data: groupsResponse } = useQuery({
    queryKey: ['admin', 'endpoint-groups'],
    queryFn: getEndpointGroups,
  });

  const endpoints: ApiEndpoint[] = endpointsResponse?.data ?? endpointsResponse?.endpoints ?? [];
  const groups: EndpointGroup[] = groupsResponse?.data ?? groupsResponse?.groups ?? [];

  // Derive unique entity values from endpoints
  const entities = useMemo(() => {
    const set = new Set<string>();
    endpoints.forEach((e) => { if (e.Entity) set.add(e.Entity); });
    return Array.from(set).sort();
  }, [endpoints]);

  const discoverMutation = useMutation({
    mutationFn: discoverEndpoints,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'endpoints'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'endpoint-groups'] });
      const result = data?.data ?? data;
      const discovered = result?.discovered ?? 0;
      const created = result?.created ?? 0;
      const updated = result?.updated ?? 0;
      toast.success(`Discovered ${discovered}, created ${created}, updated ${updated} endpoints`);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to discover endpoints'),
  });

  // Client-side search filter
  const filteredEndpoints = useMemo(() => {
    if (!search) return endpoints;
    const s = search.toLowerCase();
    return endpoints.filter(
      (e) =>
        e.Path.toLowerCase().includes(s) ||
        e.Method.toLowerCase().includes(s) ||
        (e.Entity && e.Entity.toLowerCase().includes(s)) ||
        (e.Action && e.Action.toLowerCase().includes(s)) ||
        (e.GroupName && e.GroupName.toLowerCase().includes(s))
    );
  }, [endpoints, search]);

  const columns: ColumnDef<ApiEndpoint>[] = useMemo(
    () => [
      {
        key: 'Path',
        label: 'Path',
        sortable: true,
        width: 360,
        render: (val: string) => (
          <span className="font-mono text-xs text-semantic-text-default">{val}</span>
        ),
      },
      {
        key: 'Method',
        label: 'Method',
        sortable: true,
        width: 100,
        render: (val: string) => (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${METHOD_COLORS[val] || 'bg-surface-overlay text-semantic-text-faint'}`}>
            {val}
          </span>
        ),
      },
      {
        key: 'Entity',
        label: 'Entity',
        sortable: true,
        width: 140,
        render: (val: string) => (
          <span className="text-sm text-semantic-text-secondary">{val || '-'}</span>
        ),
      },
      {
        key: 'Action',
        label: 'Action',
        sortable: true,
        width: 120,
        render: (val: string) => (
          <span className="text-sm text-semantic-text-secondary">{val || '-'}</span>
        ),
      },
      {
        key: 'GroupName',
        label: 'Group',
        sortable: true,
        width: 140,
        render: (val: string) => (
          <span className="text-sm text-semantic-text-faint">{val || '-'}</span>
        ),
      },
    ],
    []
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TableCard
        title="API Endpoints"
        icon={<Globe className="w-4 h-4" />}
        count={filteredEndpoints.length}
        search={{ value: search, onChange: setSearch, placeholder: "Search endpoints by path, method, entity, or group..." }}
        headerActions={
          <div className="flex items-center gap-2">
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="h-8 px-2 text-xs bg-surface-overlay border border-border rounded-lg text-semantic-text-default focus:outline-none focus:ring-2 focus:ring-interactive-focus-ring"
              title="Filter by entity"
            >
              <option value="">All Entities</option>
              {entities.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="h-8 px-2 text-xs bg-surface-overlay border border-border rounded-lg text-semantic-text-default focus:outline-none focus:ring-2 focus:ring-interactive-focus-ring"
              title="Filter by group"
            >
              <option value="">All Groups</option>
              {groups.map((g) => (
                <option key={g.GroupId} value={g.GroupId}>{g.Name}</option>
              ))}
            </select>
            <Button
              size="sm"
              icon={<RefreshCw className={`w-3.5 h-3.5 ${discoverMutation.isPending ? 'animate-spin' : ''}`} />}
              onClick={() => discoverMutation.mutate()}
              loading={discoverMutation.isPending}
            >
              Discover Endpoints
            </Button>
          </div>
        }
      >
        <DataTable<ApiEndpoint>
          id="admin-endpoints"
          columns={columns}
          data={filteredEndpoints}
          rowKey="EndpointId"
          emptyMessage="No endpoints found"
          emptyIcon={Globe}
          embedded
          showColumnPicker={false}
          showFilters={false}
        />
      </TableCard>
    </div>
  );
}
