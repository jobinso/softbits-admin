import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Brain, Cpu, Save, Zap, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, Tabs, StatusBadge, LoadingSpinner, PageHeader } from '@/components/shared';
import type { TabItem } from '@/components/shared';
import type { InfuseConfig } from '@/types';
import {
  getInfuseConfig,
  updateInfuseConfig,
  testInfuseConnection,
  testMcpConnection,
} from '@/services/admin-service';

// ===== Constants =====

const PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openai', label: 'OpenAI (GPT)' },
  { value: 'ollama', label: 'Ollama (Local)' },
  { value: 'lmstudio', label: 'LM Studio (Local)' },
  { value: 'vllm', label: 'vLLM (High-Throughput)' },
];

const MODELS: Record<string, Array<{ value: string; label: string }>> = {
  anthropic: [
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
  ],
  openai: [
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  ],
  ollama: [
    { value: 'qwen2.5:7b', label: 'Qwen 2.5 7B' },
    { value: 'llama3.1:8b', label: 'Llama 3.1 8B' },
    { value: 'mistral:7b', label: 'Mistral 7B' },
    { value: 'custom', label: 'Custom Model' },
  ],
  vllm: [
    { value: 'meta-llama/Llama-3.1-8B-Instruct', label: 'Llama 3.1 8B Instruct' },
    { value: 'mistralai/Mistral-7B-Instruct-v0.3', label: 'Mistral 7B Instruct' },
    { value: 'custom', label: 'Custom Model' },
  ],
  lmstudio: [
    { value: 'custom', label: 'Custom Model (loaded in LM Studio)' },
  ],
};

const tabs: TabItem[] = [
  { id: 'config', label: 'Configuration', icon: <Cpu className="w-4 h-4" /> },
  { id: 'mcptest', label: 'MCP Testing', icon: <Zap className="w-4 h-4" /> },
];

// ===== Component =====

export default function InfuseAdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('config');

  // Config form state
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState('anthropic');
  const [model, setModel] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyMasked, setApiKeyMasked] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [includeUserProfile, setIncludeUserProfile] = useState(true);
  const [includeCurrentView, setIncludeCurrentView] = useState(true);
  const [includeSelectedEntity, setIncludeSelectedEntity] = useState(true);
  // vLLM multi-session
  const [vllmMultiEnabled, setVllmMultiEnabled] = useState(false);
  const [vllmMaxConcurrent, setVllmMaxConcurrent] = useState(10);
  const [vllmRateLimit, setVllmRateLimit] = useState(20);
  const [vllmQueueSize, setVllmQueueSize] = useState(5);
  const [vllmTimeout, setVllmTimeout] = useState(120000);

  // MCP test state
  const [mcpServerUrl, setMcpServerUrl] = useState('');
  const [mcpAuthType, setMcpAuthType] = useState('none');
  const [mcpAuthValue, setMcpAuthValue] = useState('');
  const [mcpConnectionStatus, setMcpConnectionStatus] = useState('');
  const [mcpStatusColor, setMcpStatusColor] = useState('text-dark-400');

  const [configLoaded, setConfigLoaded] = useState(false);

  // ===== Queries =====

  const { isLoading } = useQuery({
    queryKey: ['admin', 'infuse', 'config'],
    queryFn: getInfuseConfig,
    onSuccess: (data: { config?: InfuseConfig }) => {
      const config = data.config || {} as InfuseConfig;
      setEnabled(config.enabled || false);
      setProvider(config.aiProvider || 'anthropic');
      setSystemPrompt(config.systemPrompt || '');
      setIncludeUserProfile(config.context?.includeUserProfile !== false);
      setIncludeCurrentView(config.context?.includeCurrentView !== false);
      setIncludeSelectedEntity(config.context?.includeSelectedEntity !== false);

      const p = config.aiProvider || 'anthropic';
      const providerConfig = (config as Record<string, any>)[p] || {};
      if (providerConfig.apiKey) {
        setApiKey('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' + providerConfig.apiKey.slice(-4));
        setApiKeyMasked(true);
      } else {
        setApiKey('');
        setApiKeyMasked(false);
      }
      setBaseUrl(providerConfig.baseUrl || '');
      setModel(providerConfig.model || '');
      setCustomModel('');

      if (p === 'vllm' && providerConfig.multiSession) {
        const ms = providerConfig.multiSession;
        setVllmMultiEnabled(ms.enabled !== false);
        setVllmMaxConcurrent(ms.maxConcurrent || 10);
        setVllmRateLimit(ms.rateLimitPerUser || 20);
        setVllmQueueSize(ms.userQueueSize || 5);
        setVllmTimeout(ms.requestTimeout || 120000);
      }
      setConfigLoaded(true);
    },
  } as any);

  // ===== Mutations =====

  const saveMutation = useMutation({
    mutationFn: (config: Record<string, unknown>) => updateInfuseConfig({ config }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'infuse', 'config'] });
      toast.success('Configuration saved');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save configuration'),
  });

  const testMutation = useMutation({
    mutationFn: testInfuseConnection,
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Connection successful! Response time: ${data.latency}ms`);
      } else {
        toast.error('Connection failed: ' + (data.message || data.error || 'Unknown error'));
      }
    },
    onError: (err: Error) => toast.error('Connection test failed: ' + err.message),
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
    const effectiveModel = model === 'custom' ? customModel : model;
    const providerConfig: Record<string, unknown> = { model: effectiveModel };

    if (provider !== 'ollama' && provider !== 'lmstudio') {
      const key = apiKeyMasked ? null : apiKey;
      if (key) providerConfig.apiKey = key;
    }

    if (['ollama', 'openai', 'vllm', 'lmstudio'].includes(provider) && baseUrl) {
      providerConfig.baseUrl = baseUrl;
    }

    if (provider === 'vllm') {
      providerConfig.multiSession = {
        enabled: vllmMultiEnabled,
        maxConcurrent: vllmMaxConcurrent,
        rateLimitPerUser: vllmRateLimit,
        userQueueSize: vllmQueueSize,
        requestTimeout: vllmTimeout,
      };
    }

    const config: Record<string, unknown> = {
      enabled,
      aiProvider: provider,
      context: { includeUserProfile, includeCurrentView, includeSelectedEntity },
      systemPrompt,
      [provider]: providerConfig,
    };

    saveMutation.mutate(config);
  }

  function handleTest() {
    const effectiveModel = model === 'custom' ? customModel : model;
    const key = apiKeyMasked ? null : apiKey;
    const payload: { provider: string; model: string; apiKey?: string | null; baseUrl?: string } = { provider, model: effectiveModel };
    if (provider !== 'ollama' && provider !== 'lmstudio' && key) payload.apiKey = key;
    if (['ollama', 'openai', 'vllm', 'lmstudio'].includes(provider) && baseUrl) payload.baseUrl = baseUrl;
    testMutation.mutate(payload);
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

  function handleApiKeyChange(value: string) {
    setApiKey(value);
    setApiKeyMasked(false);
  }

  const showBaseUrl = ['ollama', 'openai', 'vllm', 'lmstudio'].includes(provider);
  const showApiKeyField = provider !== 'ollama' && provider !== 'lmstudio';
  const providerModels = MODELS[provider] || [];
  const showCustomModel = model === 'custom';

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
        title="InfuseIT Admin"
        description="Configure AI providers, models, and MCP integration"
        icon={<Brain className="w-5 h-5" />}
        actions={
          <StatusBadge
            status={enabled ? 'success' : 'neutral'}
            label={enabled ? 'Enabled' : 'Disabled'}
            size="sm"
          />
        }
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab: Configuration */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          {/* Enable Toggle + Provider */}
          <Card title="AI Provider">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="rounded border-dark-300 bg-dark-200 text-primary focus:ring-primary/50"
                  />
                  <span className="text-sm text-dark-600">{enabled ? 'Enabled' : 'Disabled'}</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Provider">
                  <select
                    value={provider}
                    onChange={(e) => {
                      setProvider(e.target.value);
                      setModel('');
                      setCustomModel('');
                    }}
                    className="form-input"
                    title="AI Provider"
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Model">
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="form-input"
                    title="Model"
                  >
                    <option value="">-- Select Model --</option>
                    {providerModels.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </FormField>
              </div>

              {showCustomModel && (
                <FormField label="Custom Model Name">
                  <input
                    type="text"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    className="form-input"
                    placeholder="e.g., my-custom-model:latest"
                  />
                </FormField>
              )}

              {showApiKeyField && (
                <FormField label="API Key">
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => handleApiKeyChange(e.target.value)}
                      className="form-input pr-10"
                      placeholder="Enter API key"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-dark-400 hover:text-dark-600"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </FormField>
              )}

              {showBaseUrl && (
                <FormField label="Base URL">
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="form-input"
                    placeholder={
                      provider === 'ollama' ? 'http://localhost:11434' :
                      provider === 'lmstudio' ? 'http://localhost:1234' :
                      provider === 'vllm' ? 'http://localhost:8000' :
                      'https://api.openai.com (or custom endpoint)'
                    }
                  />
                </FormField>
              )}

              {/* vLLM Multi-Session */}
              {provider === 'vllm' && (
                <div className="border-t border-dark-200 pt-4 mt-4">
                  <h4 className="text-xs font-medium text-dark-500 mb-3">Multi-Session Settings</h4>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={vllmMultiEnabled}
                        onChange={(e) => setVllmMultiEnabled(e.target.checked)}
                        className="rounded border-dark-300 bg-dark-200 text-primary focus:ring-primary/50"
                      />
                      <span className="text-sm text-dark-600">Enable multi-session</span>
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="Max Concurrent">
                        <input type="number" value={vllmMaxConcurrent} onChange={(e) => setVllmMaxConcurrent(parseInt(e.target.value) || 10)} className="form-input" />
                      </FormField>
                      <FormField label="Rate Limit/User">
                        <input type="number" value={vllmRateLimit} onChange={(e) => setVllmRateLimit(parseInt(e.target.value) || 20)} className="form-input" />
                      </FormField>
                      <FormField label="User Queue Size">
                        <input type="number" value={vllmQueueSize} onChange={(e) => setVllmQueueSize(parseInt(e.target.value) || 5)} className="form-input" />
                      </FormField>
                      <FormField label="Request Timeout (ms)">
                        <input type="number" value={vllmTimeout} onChange={(e) => setVllmTimeout(parseInt(e.target.value) || 120000)} className="form-input" />
                      </FormField>
                    </div>
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
                  onClick={handleTest}
                  loading={testMutation.isPending}
                >
                  Test Connection
                </Button>
              </div>
            </div>
          </Card>

          {/* Context Options */}
          <Card title="Context Settings">
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeUserProfile}
                  onChange={(e) => setIncludeUserProfile(e.target.checked)}
                  className="rounded border-dark-300 bg-dark-200 text-primary focus:ring-primary/50"
                />
                <span className="text-sm text-dark-600">Include user profile in context</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCurrentView}
                  onChange={(e) => setIncludeCurrentView(e.target.checked)}
                  className="rounded border-dark-300 bg-dark-200 text-primary focus:ring-primary/50"
                />
                <span className="text-sm text-dark-600">Include current view in context</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSelectedEntity}
                  onChange={(e) => setIncludeSelectedEntity(e.target.checked)}
                  className="rounded border-dark-300 bg-dark-200 text-primary focus:ring-primary/50"
                />
                <span className="text-sm text-dark-600">Include selected entity in context</span>
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
      <label className="block text-xs font-medium text-dark-500 mb-1">{label}</label>
      {children}
    </div>
  );
}
