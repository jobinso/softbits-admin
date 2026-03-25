import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Cpu, Save, Zap, Star, ExternalLink, LayoutDashboard, Plug, Shield, Clock, Activity, Server, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, Tabs, StatusBadge, LoadingSpinner, PageHeader, DataTable, TableCard } from '@/components/shared';
import type { ColumnDef } from '@/components/shared';
import type { TabItem } from '@/components/shared';
import type { InfuseConfig, Provider } from '@/types';
import OAuthPkceFlow from '../components/oauth-pkce-flow';
import {
  getInfuseConfig,
  updateInfuseConfig,
  testMcpConnection,
  getInfuseStatus,
  getProviders,
  testProvider,
  getInfuseDashboard,
} from '@/services/admin-service';

// ===== Constants =====

// Map ProviderTypeCode to the aiProvider string used in infuse.json
const PROVIDER_TYPE_MAP: Record<string, string> = {
  'AI_ANTHROPIC': 'anthropic',
  'AI_OPENAI': 'openai',
  'AI_OLLAMA': 'ollama',
  'AI_LMSTUDIO': 'lmstudio',
  'AI_VLLM': 'vllm',
};

const INFUSE_PROVIDER_CATEGORIES = ['AI', 'INTERNAL', 'AUTOMATION', 'OAUTH'];

const tabs: TabItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'config', label: 'Configuration', icon: <Cpu className="w-4 h-4" /> },
  { id: 'providers', label: 'Providers', icon: <Plug className="w-4 h-4" /> },
  { id: 'mcptest', label: 'MCP Testing', icon: <Zap className="w-4 h-4" /> },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const providerColumns: ColumnDef<any>[] = [
  {
    key: 'Name', label: 'Name', sortable: true,
    render: (val) => <span className="font-medium text-semantic-text-default">{val}</span>,
  },
  {
    key: 'Category', label: 'Category', width: 130, sortable: true,
    render: (val) => {
      const colorMap: Record<string, 'info' | 'success' | 'warning' | 'neutral'> = {
        AI: 'info', INTERNAL: 'neutral', AUTOMATION: 'warning', OAUTH: 'success',
      };
      return <StatusBadge status={colorMap[val as string] || 'neutral'} label={val as string} size="sm" />;
    },
  },
  {
    key: 'ProviderTypeCode', label: 'Type', width: 180, sortable: true,
    render: (_val, row) => <span className="text-semantic-text-faint">{row.TypeDisplayName || row.ProviderTypeCode}</span>,
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
          <StatusBadge status={statusMap[val as string] || 'danger'} label={val === 'ok' ? 'OK' : val === 'warning' ? 'Warning' : 'Failed'} size="sm" />
        </span>
      );
    },
  },
  {
    key: 'LastTestedAt', label: 'Last Tested', width: 140,
    render: (val) => <span className="text-xs text-semantic-text-faint">{val ? new Date(val as string).toLocaleString() : '-'}</span>,
  },
];

// ===== Component =====

export default function InfuseAdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Config form state
  const [enabled, setEnabled] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [includeUserProfile, setIncludeUserProfile] = useState(true);
  const [includeCurrentView, setIncludeCurrentView] = useState(true);
  const [includeSelectedEntity, setIncludeSelectedEntity] = useState(true);

  // MCP test state
  const [mcpServerUrl, setMcpServerUrl] = useState('');
  const [mcpAuthType, setMcpAuthType] = useState('none');
  const [mcpAuthValue, setMcpAuthValue] = useState('');
  const [mcpConnectionStatus, setMcpConnectionStatus] = useState('');
  const [mcpStatusColor, setMcpStatusColor] = useState('text-semantic-text-faint');

  const [configLoaded, setConfigLoaded] = useState(false);
  const [testingAiProvider, setTestingAiProvider] = useState(false);

  // ===== Queries =====

  const { data: configData, isLoading } = useQuery({
    queryKey: ['admin', 'infuse', 'config'],
    queryFn: getInfuseConfig,
  });

  const { data: statusData } = useQuery({
    queryKey: ['admin', 'infuse', 'status'],
    queryFn: getInfuseStatus,
    refetchInterval: 15000,
  });

  const { data: dashboardData } = useQuery({
    queryKey: ['admin', 'infuse', 'dashboard'],
    queryFn: getInfuseDashboard,
    enabled: activeTab === 'dashboard',
    refetchInterval: 15000,
  });

  const { data: aiProvidersResponse } = useQuery({
    queryKey: ['admin', 'providers', { category: 'AI' }],
    queryFn: () => getProviders({ category: 'AI' }),
    enabled: activeTab === 'config',
  });

  const { data: infuseProvidersData, isLoading: providersTabLoading } = useQuery({
    queryKey: ['admin', 'providers', 'infuse-relevant'],
    queryFn: () => getProviders({ category: undefined }),
    enabled: activeTab === 'providers',
  });

  const aiProviders: Provider[] = aiProvidersResponse?.data || [];


  useEffect(() => {
    if (!configData?.config) return;
    const config = configData.config as InfuseConfig;
    setEnabled(config.enabled || false);
    setSystemPrompt(config.systemPrompt || '');
    setIncludeUserProfile(config.context?.includeUserProfile !== false);
    setIncludeCurrentView(config.context?.includeCurrentView !== false);
    setIncludeSelectedEntity(config.context?.includeSelectedEntity !== false);

    // Restore selected provider: use providerId if saved, otherwise auto-match by aiProvider string
    if (config.providerId) {
      setSelectedProviderId(config.providerId);
    } else if (config.aiProvider && aiProviders.length > 0) {
      const reverseMap: Record<string, string> = {};
      for (const [typeCode, name] of Object.entries(PROVIDER_TYPE_MAP)) {
        reverseMap[name] = typeCode;
      }
      const typeCode = reverseMap[config.aiProvider];
      const match = aiProviders.find(p => p.ProviderTypeCode === typeCode);
      if (match) setSelectedProviderId(match.ProviderId);
    }

    setConfigLoaded(true);
  }, [configData, aiProviders]);

  // ===== Mutations =====

  const saveMutation = useMutation({
    mutationFn: (config: Record<string, unknown>) => updateInfuseConfig({ config }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'infuse', 'config'] });
      toast.success('Configuration saved');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save configuration'),
  });

  const mcpTestMutation = useMutation({
    mutationFn: testMcpConnection,
    onSuccess: (data) => {
      if (data.success) {
        setMcpConnectionStatus(`Connected! (${data.latency}ms)`);
        setMcpStatusColor('text-primary');
      } else {
        setMcpConnectionStatus(`Failed: ${data.error || 'Unknown error'}`);
        setMcpStatusColor('text-danger');
      }
    },
    onError: (err: Error) => {
      setMcpConnectionStatus(`Error: ${err.message}`);
      setMcpStatusColor('text-danger');
    },
  });

  // ===== Handlers =====

  function handleSave() {
    if (!selectedProviderId) {
      toast.error('Select an AI provider first');
      return;
    }
    const config: Record<string, unknown> = {
      providerId: selectedProviderId,
      enabled,
      context: { includeUserProfile, includeCurrentView, includeSelectedEntity },
      systemPrompt,
    };
    saveMutation.mutate(config);
  }

  async function handleTestAiProvider() {
    if (!selectedProviderId) {
      toast.error('Select an AI provider first');
      return;
    }
    setTestingAiProvider(true);
    try {
      const result = await testProvider(selectedProviderId);
      if (result.ok) {
        toast.success(result.message || 'Connection successful');
      } else {
        toast.error(result.message || 'Connection failed');
      }
      queryClient.invalidateQueries({ queryKey: ['admin', 'providers', { category: 'AI' }] });
    } catch {
      toast.error('Connection test failed');
    } finally {
      setTestingAiProvider(false);
    }
  }

  function handleMcpTest() {
    setMcpConnectionStatus('Testing...');
    setMcpStatusColor('text-warning');
    const effectiveAuthType = mcpAuthType === 'oauth' ? 'bearer' : mcpAuthType;
    mcpTestMutation.mutate({
      serverUrl: mcpServerUrl || null,
      authType: effectiveAuthType !== 'none' ? effectiveAuthType : null,
      authValue: mcpAuthValue || null,
    });
  }

  // Filtered providers for Providers tab
  const filteredProviders: Provider[] = (infuseProvidersData?.data || [])
    .filter((p: Provider) => INFUSE_PROVIDER_CATEGORIES.includes(p.Category || ''));

  // ===== Render =====

  if (isLoading || !configLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="InfuseIT"
        description="AI integration services configuration"
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab: Dashboard */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Status Bar — pill style matching Licensing */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 p-4 bg-surface-raised border border-border rounded-xl">
            <div>
              <p className="text-xs text-semantic-text-faint mb-1">AI Provider</p>
              <StatusBadge status={enabled ? 'success' : 'neutral'} label={enabled ? 'Enabled' : 'Disabled'} size="sm" />
            </div>
            <div>
              <p className="text-xs text-semantic-text-faint mb-1">MCP</p>
              <StatusBadge status={statusData?.data?.mcp?.status === 'ok' ? 'success' : 'danger'} label={statusData?.data?.mcp?.status === 'ok' ? 'Online' : 'Offline'} size="sm" />
              {dashboardData?.data?.sessions?.mcp && <p className="text-xs text-semantic-text-faint mt-0.5">{dashboardData.data.sessions.mcp.active} sessions</p>}
            </div>
            <div>
              <p className="text-xs text-semantic-text-faint mb-1">APP</p>
              <StatusBadge status={statusData?.data?.app?.status === 'ok' ? 'success' : 'danger'} label={statusData?.data?.app?.status === 'ok' ? 'Online' : 'Offline'} size="sm" />
              {dashboardData?.data?.sessions?.app && <p className="text-xs text-semantic-text-faint mt-0.5">{dashboardData.data.sessions.app.active} sessions</p>}
            </div>
            <div>
              <p className="text-xs text-semantic-text-faint mb-1">HTTP</p>
              <StatusBadge status={statusData?.data?.http?.status === 'ok' ? 'success' : 'danger'} label={statusData?.data?.http?.status === 'ok' ? 'Online' : 'Offline'} size="sm" />
            </div>
            <div>
              <p className="text-xs text-semantic-text-faint mb-1">WORK</p>
              <StatusBadge status={statusData?.data?.work?.status === 'ok' ? 'success' : 'danger'} label={statusData?.data?.work?.status === 'ok' ? 'Online' : 'Offline'} size="sm" />
              {dashboardData?.data?.workload?.work && <p className="text-xs text-semantic-text-faint mt-0.5">{dashboardData.data.workload.work.pendingExecutions} pending</p>}
            </div>
          </div>

          {/* Sessions */}
          {dashboardData?.data?.sessions && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* MCP Sessions */}
              <Card title="MCP Sessions">
                {dashboardData.data.sessions.mcp ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-semantic-text-faint" />
                      <span className="text-2xl font-semibold text-semantic-text-default">{dashboardData.data.sessions.mcp.active}</span>
                      <span className="text-sm text-semantic-text-secondary">active</span>
                    </div>
                    <div>
                      <p className="text-xs text-semantic-text-faint mb-0.5">Session Persistence</p>
                      <StatusBadge
                        status={dashboardData.data.sessions.mcp.persistenceEnabled && dashboardData.data.sessions.mcp.persistenceAvailable ? 'success' : dashboardData.data.sessions.mcp.persistenceEnabled ? 'warning' : 'neutral'}
                        label={dashboardData.data.sessions.mcp.persistenceEnabled ? (dashboardData.data.sessions.mcp.persistenceAvailable ? 'Redis Connected' : 'Redis Unavailable') : 'Disabled'}
                        size="sm"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-semantic-text-faint">Service unavailable</p>
                )}
              </Card>

              {/* APP Sessions */}
              <Card title="APP Sessions">
                {dashboardData.data.sessions.app ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-semantic-text-faint" />
                      <span className="text-2xl font-semibold text-semantic-text-default">{dashboardData.data.sessions.app.active}</span>
                      <span className="text-sm text-semantic-text-secondary">active</span>
                    </div>
                    <div>
                      <p className="text-xs text-semantic-text-faint mb-0.5">Session Persistence</p>
                      <StatusBadge
                        status={dashboardData.data.sessions.app.persistenceEnabled && dashboardData.data.sessions.app.persistenceAvailable ? 'success' : dashboardData.data.sessions.app.persistenceEnabled ? 'warning' : 'neutral'}
                        label={dashboardData.data.sessions.app.persistenceEnabled ? (dashboardData.data.sessions.app.persistenceAvailable ? 'Redis Connected' : 'Redis Unavailable') : 'Disabled'}
                        size="sm"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-semantic-text-faint">Service unavailable</p>
                )}
              </Card>
            </div>
          )}

          {/* Workload */}
          {dashboardData?.data?.workload && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Execution Stats */}
              <Card title="Workflow Executions">
                {dashboardData.data.workload.executions ? (
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-semantic-text-faint mb-0.5">Total</p>
                      <p className="text-lg font-semibold text-semantic-text-default">{dashboardData.data.workload.executions.total.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-semantic-text-faint mb-0.5">Running</p>
                      <p className="text-lg font-semibold text-amber-400">{dashboardData.data.workload.executions.running}</p>
                    </div>
                    <div>
                      <p className="text-xs text-semantic-text-faint mb-0.5">Pending</p>
                      <p className="text-lg font-semibold text-amber-400">{dashboardData.data.workload.executions.pending}</p>
                    </div>
                    <div>
                      <p className="text-xs text-semantic-text-faint mb-0.5">Success</p>
                      <p className="text-lg font-semibold text-emerald-400">{dashboardData.data.workload.executions.success.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-semantic-text-faint mb-0.5">Failed</p>
                      <p className="text-lg font-semibold text-red-400">{dashboardData.data.workload.executions.failed}</p>
                    </div>
                    <div>
                      <p className="text-xs text-semantic-text-faint mb-0.5">Timeout</p>
                      <p className="text-lg font-semibold text-red-400">{dashboardData.data.workload.executions.timeout}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-semantic-text-faint">Work service unavailable</p>
                )}
              </Card>

              {/* Chat/vLLM Stats - only when available */}
              {dashboardData.data.workload.chat ? (
                <Card title="AI Chat Workload">
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-semantic-text-faint mb-0.5">Total</p>
                        <p className="text-lg font-semibold text-semantic-text-default">{dashboardData.data.workload.chat.totalRequests.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-semantic-text-faint mb-0.5">Completed</p>
                        <p className="text-lg font-semibold text-emerald-400">{dashboardData.data.workload.chat.completedRequests.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-semantic-text-faint mb-0.5">Failed</p>
                        <p className="text-lg font-semibold text-red-400">{dashboardData.data.workload.chat.failedRequests}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-semantic-text-faint mb-0.5">Active / Queue</p>
                        <p className="text-sm text-semantic-text-secondary">{dashboardData.data.workload.chat.activeRequests} active, {dashboardData.data.workload.chat.queueSize} queued</p>
                      </div>
                      <div>
                        <p className="text-xs text-semantic-text-faint mb-0.5">Circuit Breaker</p>
                        <StatusBadge
                          status={dashboardData.data.workload.chat.circuitBreaker.isOpen ? 'danger' : 'success'}
                          label={dashboardData.data.workload.chat.circuitBreaker.isOpen ? 'Open' : 'Closed'}
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              ) : (
                /* Work service info card when no chat stats */
                dashboardData.data.workload.work ? (
                  <Card title="Work Service">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-semantic-text-faint mb-0.5">Pending Executions</p>
                          <p className="text-lg font-semibold text-semantic-text-default">{dashboardData.data.workload.work.pendingExecutions}</p>
                        </div>
                        <div>
                          <p className="text-xs text-semantic-text-faint mb-0.5">Database</p>
                          <StatusBadge status={dashboardData.data.workload.work.database.status === 'ok' ? 'success' : 'danger'} label={dashboardData.data.workload.work.database.status === 'ok' ? 'Connected' : 'Error'} size="sm" />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-semantic-text-faint mb-0.5">N8N</p>
                        <StatusBadge status={dashboardData.data.workload.work.n8n.connected ? 'success' : 'danger'} label={dashboardData.data.workload.work.n8n.connected ? 'Connected' : 'Disconnected'} size="sm" />
                      </div>
                    </div>
                  </Card>
                ) : null
              )}
            </div>
          )}

          {/* Dashboard cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Active AI Provider */}
            <Card title="Active AI Provider">
              {dashboardData?.data?.aiProvider ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-semantic-text-faint" />
                    <span className="font-medium text-semantic-text-default">{dashboardData.data.aiProvider.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-semantic-text-faint mb-0.5">Type</p>
                      <p className="text-semantic-text-secondary">{dashboardData.data.aiProvider.type}</p>
                    </div>
                    <div>
                      <p className="text-xs text-semantic-text-faint mb-0.5">Model</p>
                      <p className="text-semantic-text-secondary font-mono text-xs">{dashboardData.data.aiProvider.model || '-'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-semantic-text-faint mb-0.5">Health</p>
                    {dashboardData.data.aiProvider.healthStatus ? (
                      <StatusBadge
                        status={dashboardData.data.aiProvider.healthStatus === 'ok' ? 'success' : dashboardData.data.aiProvider.healthStatus === 'warning' ? 'warning' : 'danger'}
                        label={dashboardData.data.aiProvider.healthStatus === 'ok' ? 'OK' : dashboardData.data.aiProvider.healthStatus === 'warning' ? 'Warning' : 'Failed'}
                        size="sm"
                      />
                    ) : (
                      <span className="text-xs text-semantic-text-faint">Not tested</span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-semantic-text-faint">No AI provider configured</p>
              )}
            </Card>

            {/* OAuth Server */}
            <Card title="OAuth Server">
              {dashboardData?.data?.oauthServer ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-semantic-text-faint" />
                    <StatusBadge
                      status={dashboardData.data.oauthServer.enabled ? 'success' : 'neutral'}
                      label={dashboardData.data.oauthServer.enabled ? 'Enabled' : 'Disabled'}
                      size="sm"
                    />
                  </div>
                  <div className="text-sm space-y-2">
                    <div>
                      <p className="text-xs text-semantic-text-faint mb-0.5">Issuer URL</p>
                      <p className="text-semantic-text-secondary font-mono text-xs break-all">{dashboardData.data.oauthServer.issuer || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-semantic-text-faint mb-0.5">Resource URI</p>
                      <p className="text-semantic-text-secondary font-mono text-xs break-all">{dashboardData.data.oauthServer.mcpResourceUri || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-semantic-text-faint mb-0.5">Callback URLs</p>
                      {dashboardData.data.oauthServer.allowedCallbackUrls?.length > 0 ? (
                        <ul className="space-y-0.5">
                          {dashboardData.data.oauthServer.allowedCallbackUrls.map((url: string, i: number) => (
                            <li key={i} className="text-semantic-text-secondary font-mono text-xs break-all">{url}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-semantic-text-faint text-xs">None configured</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-semantic-text-faint">OAuth server data unavailable</p>
              )}
            </Card>
          </div>

          {/* Workflow Performance */}
          {dashboardData?.data?.workload?.workflows && dashboardData.data.workload.workflows.length > 0 && (
            <TableCard title="Workflow Performance" count={dashboardData.data.workload.workflows.length}>
              <DataTable
                data={dashboardData.data.workload.workflows as unknown as Record<string, any>[]}
                columns={[
                  { key: 'workflowName', label: 'Workflow', sortable: true, render: (val) => <span className="font-medium text-semantic-text-default">{val}</span> },
                  { key: 'total', label: 'Executions', width: 100, sortable: true, render: (val) => <span className="text-semantic-text-secondary">{(val as number).toLocaleString()}</span> },
                  { key: 'success', label: 'Success', width: 100, sortable: true, render: (val) => <span className="text-emerald-400">{(val as number).toLocaleString()}</span> },
                  { key: 'failed', label: 'Failed', width: 100, sortable: true, render: (val) => <span className={`${(val as number) > 0 ? 'text-red-400' : 'text-semantic-text-faint'}`}>{val}</span> },
                  { key: 'avgDuration', label: 'Avg Duration', width: 120, sortable: true, render: (val) => <span className="text-semantic-text-faint font-mono text-xs">{((val as number) / 1000).toFixed(1)}s</span> },
                ]}
                id="infuse-workflows"
                rowKey="workflowName"
                emptyMessage="No workflow data"
              />
            </TableCard>
          )}
        </div>
      )}

      {/* Tab: Configuration */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          {/* AI Provider — provider selection pattern (matches currencies-page) */}
          <div className="rounded-lg border border-border bg-surface-raised p-6 space-y-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="rounded border-border bg-surface-subtle text-primary focus:ring-interactive-focus-ring"
                />
                <span className="text-sm text-semantic-text-secondary">{enabled ? 'Enabled' : 'Disabled'}</span>
              </label>
              <Link
                to="/providers"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary hover:text-primary-600 border border-primary/30 hover:border-primary rounded-lg transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Manage Providers
              </Link>
            </div>

            <FormField label="Active AI Provider">
              <select
                value={selectedProviderId}
                onChange={(e) => setSelectedProviderId(e.target.value)}
                className="form-input"
                title="Select AI provider"
              >
                <option value="">-- Select a provider --</option>
                {aiProviders.filter((p) => p.IsActive).map((p) => (
                  <option key={p.ProviderId} value={p.ProviderId}>{p.Name}</option>
                ))}
              </select>
            </FormField>

            {/* AI Providers table */}
            {aiProviders.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-semantic-text-subtle mb-2">Available AI Providers</p>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-surface-subtle border-b border-border">
                        <th className="text-left px-3 py-2 font-medium text-semantic-text-faint">Name</th>
                        <th className="text-left px-3 py-2 font-medium text-semantic-text-faint">Type</th>
                        <th className="text-left px-3 py-2 font-medium text-semantic-text-faint">Model</th>
                        <th className="text-left px-3 py-2 font-medium text-semantic-text-faint">Status</th>
                        <th className="text-left px-3 py-2 font-medium text-semantic-text-faint">Health</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiProviders.map((p) => {
                        const isSelected = p.ProviderId === selectedProviderId;
                        const cfg = p.Configuration as Record<string, unknown> | null;
                        return (
                          <tr
                            key={p.ProviderId}
                            className={`border-b border-border last:border-0 ${isSelected ? 'bg-accent-primary/5' : ''}`}
                          >
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                {isSelected && <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />}
                                <span className={isSelected ? 'font-medium text-semantic-text-default' : 'text-semantic-text-subtle'}>{p.Name}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-semantic-text-faint">{p.TypeDisplayName || p.ProviderTypeCode}</td>
                            <td className="px-3 py-2 text-semantic-text-faint font-mono">{(cfg?.model as string) || '-'}</td>
                            <td className="px-3 py-2">
                              <StatusBadge status={p.IsActive ? 'success' : 'danger'} label={p.IsActive ? 'Active' : 'Inactive'} size="sm" />
                            </td>
                            <td className="px-3 py-2">
                              {p.LastTestStatus ? (
                                <StatusBadge
                                  status={p.LastTestStatus === 'ok' ? 'success' : p.LastTestStatus === 'warning' ? 'warning' : 'danger'}
                                  label={p.LastTestStatus === 'ok' ? 'OK' : p.LastTestStatus === 'warning' ? 'Warning' : 'Failed'}
                                  size="sm"
                                />
                              ) : (
                                <span className="text-semantic-text-faint">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button
                icon={<Save className="w-4 h-4" />}
                onClick={handleSave}
                loading={saveMutation.isPending}
              >
                Save Configuration
              </Button>
              <Button
                variant="secondary"
                icon={<Zap className="w-4 h-4" />}
                onClick={handleTestAiProvider}
                loading={testingAiProvider}
              >
                Test Connection
              </Button>
            </div>
          </div>

          {/* Context Options */}
          <Card title="Context Settings">
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeUserProfile}
                  onChange={(e) => setIncludeUserProfile(e.target.checked)}
                  className="rounded border-border bg-surface-subtle text-primary focus:ring-interactive-focus-ring"
                />
                <span className="text-sm text-semantic-text-secondary">Include user profile in context</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCurrentView}
                  onChange={(e) => setIncludeCurrentView(e.target.checked)}
                  className="rounded border-border bg-surface-subtle text-primary focus:ring-interactive-focus-ring"
                />
                <span className="text-sm text-semantic-text-secondary">Include current view in context</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSelectedEntity}
                  onChange={(e) => setIncludeSelectedEntity(e.target.checked)}
                  className="rounded border-border bg-surface-subtle text-primary focus:ring-interactive-focus-ring"
                />
                <span className="text-sm text-semantic-text-secondary">Include selected entity in context</span>
              </label>
            </div>
          </Card>

          {/* System Prompt */}
          <Card title="System Prompt">
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="form-input font-mono text-sm"
              rows={8}
              placeholder="Enter system prompt for the AI model..."
            />
          </Card>
        </div>
      )}

      {/* Tab: Providers */}
      {activeTab === 'providers' && (
        <div className="space-y-6">
          <TableCard
            title="InfuseIT Providers"
            count={filteredProviders.length}
            headerActions={
              <Link to="/providers" className="flex items-center gap-1 text-xs text-primary hover:text-primary-400 transition-colors">
                Manage All Providers <ExternalLink className="w-3 h-3" />
              </Link>
            }
          >
            {providersTabLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="md" />
              </div>
            ) : (
              <DataTable
                data={filteredProviders as unknown as Record<string, any>[]}
                columns={[
                  ...providerColumns,
                  {
                    key: 'ProviderId', label: '', width: 50, sortable: false,
                    render: (_val, row) => (
                      <Link
                        to={`/providers?tab=${row.Category}`}
                        className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover transition-colors inline-flex"
                        title="Edit in Providers"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    ),
                  },
                ]}
                id="infuse-providers"
                rowKey="ProviderId"
                emptyMessage="No InfuseIT-relevant providers configured"
              />
            )}
          </TableCard>
        </div>
      )}

      {/* Tab: MCP Testing */}
      {activeTab === 'mcptest' && (
        <div className="space-y-6">
          <Card title="MCP Server Connection">
            <div className="space-y-4">
              <FormField label="Server URL">
                <input
                  type="text"
                  value={mcpServerUrl}
                  onChange={(e) => setMcpServerUrl(e.target.value)}
                  className="form-input"
                  placeholder="Leave blank for local bridge MCP"
                />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Auth Type">
                  <select
                    value={mcpAuthType}
                    onChange={(e) => setMcpAuthType(e.target.value)}
                    className="form-input"
                    title="Auth type"
                  >
                    <option value="none">None</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="apikey">API Key</option>
                    <option value="oauth">OAuth 2.1 (PKCE)</option>
                  </select>
                </FormField>
                {mcpAuthType === 'oauth' ? (
                  <div className="col-span-1">
                    <OAuthPkceFlow
                      onTokenAcquired={(token) => setMcpAuthValue(token)}
                      issuer={dashboardData?.data?.oauthServer?.issuer}
                    />
                  </div>
                ) : (
                  <FormField label="Auth Value">
                    <input
                      type="text"
                      value={mcpAuthValue}
                      onChange={(e) => setMcpAuthValue(e.target.value)}
                      className="form-input"
                      placeholder={
                        mcpAuthType === 'bearer' ? 'Bearer token value' :
                        mcpAuthType === 'apikey' ? 'API key value' :
                        'Token or credentials'
                      }
                      disabled={mcpAuthType === 'none'}
                    />
                  </FormField>
                )}
              </div>
              <div className="flex items-center gap-4">
                <Button
                  icon={<Zap className="w-4 h-4" />}
                  onClick={handleMcpTest}
                  loading={mcpTestMutation.isPending}
                >
                  Test Connection
                </Button>
                {mcpConnectionStatus && (
                  <span className={`text-sm font-medium ${mcpStatusColor}`}>
                    {mcpConnectionStatus}
                  </span>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ===== Local helpers =====

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-semantic-text-subtle mb-1">{label}</label>
      {children}
    </div>
  );
}
