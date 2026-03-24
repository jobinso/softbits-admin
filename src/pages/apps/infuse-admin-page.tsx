import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Cpu, Save, Zap, Server, Star, Wifi, WifiOff, RefreshCw, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, Tabs, StatusBadge, LoadingSpinner, PageHeader, DataTable, TableCard } from '@/components/shared';
import type { ColumnDef } from '@/components/shared';
import type { TabItem } from '@/components/shared';
import type { InfuseConfig, Provider } from '@/types';
import {
  getInfuseConfig,
  updateInfuseConfig,
  testMcpConnection,
  getInfuseStatus,
  getProviders,
  testProvider,
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

const tabs: TabItem[] = [
  { id: 'config', label: 'Configuration', icon: <Cpu className="w-4 h-4" /> },
  { id: 'services', label: 'Services', icon: <Server className="w-4 h-4" /> },
  { id: 'mcptest', label: 'MCP Testing', icon: <Zap className="w-4 h-4" /> },
];

const serviceColumns: ColumnDef<Provider>[] = [
  {
    key: 'Name', label: 'Name', sortable: true,
    render: (val, row) => (
      <div className="flex items-center gap-2">
        <span className="font-medium text-semantic-text-default">{val}</span>
        {row.IsDefault && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />}
      </div>
    ),
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
    key: 'Configuration', label: 'Config', width: 200,
    render: (val) => {
      if (!val || typeof val !== 'object') return <span className="text-semantic-text-faint">-</span>;
      const keys = Object.keys(val as Record<string, unknown>);
      if (keys.length === 0) return <span className="text-semantic-text-faint">-</span>;
      const summary = keys.slice(0, 3).join(', ') + (keys.length > 3 ? ` (+${keys.length - 3})` : '');
      return <span className="text-xs text-semantic-text-faint" title={JSON.stringify(val, null, 2)}>{summary}</span>;
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
  const [activeTab, setActiveTab] = useState('config');

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
  const [testingId, setTestingId] = useState<string | null>(null);
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

  const { data: aiProvidersResponse } = useQuery({
    queryKey: ['admin', 'providers', { category: 'AI' }],
    queryFn: () => getProviders({ category: 'AI' }),
    enabled: activeTab === 'config',
  });

  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ['admin', 'providers', { category: 'INTERNAL' }],
    queryFn: () => getProviders({ category: 'INTERNAL' }),
    enabled: activeTab === 'services',
  });

  const aiProviders: Provider[] = aiProvidersResponse?.data || [];

  // Derive selected provider and its config
  const selectedProvider = aiProviders.find(p => p.ProviderId === selectedProviderId) || null;
  const providerConfig = selectedProvider?.Configuration as Record<string, unknown> | null;

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

  async function handleTestProvider(provider: Provider) {
    setTestingId(provider.ProviderId);
    try {
      const result = await testProvider(provider.ProviderId);
      if (result.ok) {
        toast.success(result.message || 'Connection successful');
      } else {
        toast.error(result.message || 'Connection failed');
      }
      queryClient.invalidateQueries({ queryKey: ['admin', 'providers', { category: 'INTERNAL' }] });
    } catch {
      toast.error('Connection test failed');
    } finally {
      setTestingId(null);
    }
  }

  const serviceProviders: Provider[] = servicesData?.data || [];

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

      {/* Status Bar — pill style matching Licensing */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 p-4 bg-surface-raised border border-border rounded-xl">
        <div>
          <p className="text-xs text-semantic-text-faint mb-1">AI Provider</p>
          <StatusBadge status={enabled ? 'success' : 'neutral'} label={enabled ? 'Enabled' : 'Disabled'} size="sm" />
        </div>
        <div>
          <p className="text-xs text-semantic-text-faint mb-1">MCP</p>
          <StatusBadge status={statusData?.data?.mcp?.status === 'ok' ? 'success' : 'danger'} label={statusData?.data?.mcp?.status === 'ok' ? 'Online' : 'Offline'} size="sm" />
        </div>
        <div>
          <p className="text-xs text-semantic-text-faint mb-1">APP</p>
          <StatusBadge status={statusData?.data?.app?.status === 'ok' ? 'success' : 'danger'} label={statusData?.data?.app?.status === 'ok' ? 'Online' : 'Offline'} size="sm" />
        </div>
        <div>
          <p className="text-xs text-semantic-text-faint mb-1">HTTP</p>
          <StatusBadge status={statusData?.data?.http?.status === 'ok' ? 'success' : 'danger'} label={statusData?.data?.http?.status === 'ok' ? 'Online' : 'Offline'} size="sm" />
        </div>
        <div>
          <p className="text-xs text-semantic-text-faint mb-1">WORK</p>
          <StatusBadge status={statusData?.data?.work?.status === 'ok' ? 'success' : 'danger'} label={statusData?.data?.work?.status === 'ok' ? 'Online' : 'Offline'} size="sm" />
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

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

            <FormField label="AI Provider">
              <select
                value={selectedProviderId}
                onChange={(e) => setSelectedProviderId(e.target.value)}
                className="form-input"
                title="Select AI provider"
              >
                <option value="">-- Select a provider --</option>
                {aiProviders.map((p) => (
                  <option key={p.ProviderId} value={p.ProviderId}>{p.Name}</option>
                ))}
              </select>
            </FormField>

            {/* Read-only config fields from selected provider */}
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Provider Type">
                <input
                  type="text"
                  value={selectedProvider?.TypeDisplayName || '-'}
                  className="form-input bg-surface-subtle cursor-not-allowed"
                  readOnly
                  tabIndex={-1}
                />
              </FormField>
              <FormField label="Model">
                <input
                  type="text"
                  value={(providerConfig?.model as string) || '-'}
                  className="form-input bg-surface-subtle cursor-not-allowed"
                  readOnly
                  tabIndex={-1}
                />
              </FormField>
            </div>

            <FormField label="Base URL">
              <input
                type="text"
                value={(providerConfig?.baseUrl as string) || '-'}
                className="form-input bg-surface-subtle cursor-not-allowed"
                readOnly
                tabIndex={-1}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="API Key">
                <input
                  type="text"
                  value={selectedProvider ? (selectedProvider.Credentials ? 'Configured' : 'Not set') : '-'}
                  className="form-input bg-surface-subtle cursor-not-allowed"
                  readOnly
                  tabIndex={-1}
                />
              </FormField>
              <FormField label="Health Status">
                <div className="flex items-center h-[38px]">
                  {selectedProvider?.LastTestStatus ? (
                    <StatusBadge
                      status={selectedProvider.LastTestStatus === 'ok' ? 'success' : selectedProvider.LastTestStatus === 'warning' ? 'warning' : 'danger'}
                      label={selectedProvider.LastTestStatus === 'ok' ? 'OK' : selectedProvider.LastTestStatus === 'warning' ? 'Warning' : 'Failed'}
                      size="sm"
                    />
                  ) : (
                    <span className="text-sm text-semantic-text-faint">Not tested</span>
                  )}
                </div>
              </FormField>
            </div>

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

      {/* Tab: Services */}
      {activeTab === 'services' && (
        <div className="space-y-6">
          <TableCard
            title="Internal Services"
            subtitle={`${serviceProviders.length} service${serviceProviders.length !== 1 ? 's' : ''} configured`}
            actions={
              <Link to="/providers" className="flex items-center gap-1 text-xs text-primary hover:text-primary-400 transition-colors">
                Manage Providers <ExternalLink className="w-3 h-3" />
              </Link>
            }
          >
            {servicesLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="md" />
              </div>
            ) : (
              <DataTable
                data={serviceProviders}
                columns={[
                  ...serviceColumns,
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
                ]}
                keyField="ProviderId"
                emptyMessage="No internal services configured"
                compact
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
                    <option value="basic">Basic Auth</option>
                    <option value="oauth">OAuth JWT</option>
                  </select>
                </FormField>
                <FormField label={mcpAuthType === 'oauth' ? 'OAuth JWT Token' : 'Auth Value'}>
                  <input
                    type="text"
                    value={mcpAuthValue}
                    onChange={(e) => setMcpAuthValue(e.target.value)}
                    className="form-input"
                    placeholder={
                      mcpAuthType === 'bearer' ? 'Bearer token value' :
                      mcpAuthType === 'apikey' ? 'API key value' :
                      mcpAuthType === 'basic' ? 'username:password' :
                      mcpAuthType === 'oauth' ? 'Paste OAuth JWT access token' :
                      'Token or credentials'
                    }
                    disabled={mcpAuthType === 'none'}
                  />
                </FormField>
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
