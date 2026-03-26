import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Settings, Plug, Plus, X, Shield, Globe, Server, AlertTriangle, CheckCircle, XCircle, ExternalLink, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Button,
  Modal,
  Tabs,
  StatusBadge,
  LoadingSpinner,
} from '@/components/shared';
import type { TabItem } from '@/components/shared';
import { getProviderApiDetails } from '@/services/admin-service';
import type { Provider, ProviderType, ProviderApiDetails } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProviderForm {
  providerTypeCode: string;
  name: string;
  description: string;
  configuration: string;
  credentials: string;
  applications: string[];
  scope: 'internal' | 'external';
}

interface ProviderEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: Provider | null;
  isEditing: boolean;
  providerTypes: ProviderType[];
  form: ProviderForm;
  onFormChange: (form: ProviderForm) => void;
  onSave: () => void;
  isSaving: boolean;
  appConflicts: Record<string, string>;
  appCodes: readonly string[];
  jsonErrors: { config?: string; creds?: string };
  onValidateJson: (value: string, field: 'config' | 'creds') => boolean;
  onToggleApp: (appCode: string) => void;
}

const APP_CODES = ['BRIDGE', 'CONNECT', 'STACK', 'FLOOR', 'FLIP', 'ADMIN', 'PULP', 'INFUSE', 'SHOP', 'LIC'] as const;

const PROVIDER_EXAMPLES: Record<string, { config: string; credentials: string; hint: string }> = {
  EMAIL_SMTP: {
    config: '{\n  "host": "smtp.gmail.com",\n  "port": 587,\n  "secure": false\n}',
    credentials: '{\n  "user": "noreply@company.com",\n  "password": "app-password",\n  "from": "noreply@company.com",\n  "fromName": "softBITS"\n}',
    hint: 'SMTP relay for transactional emails. Use port 587 for TLS or 465 for SSL.',
  },
  EMAIL_OAUTH_MICROSOFT: {
    config: '{\n  "tenantId": "your-azure-tenant-id"\n}',
    credentials: '{\n  "clientId": "your-azure-client-id",\n  "clientSecret": "your-client-secret"\n}',
    hint: 'Microsoft 365 OAuth for email and calendar integration.',
  },
  EMAIL_OAUTH_GOOGLE: {
    config: '{\n  "clientId": "your-client-id.apps.googleusercontent.com"\n}',
    credentials: '{\n  "clientSecret": "your-client-secret",\n  "refreshToken": "google-refresh-token"\n}',
    hint: 'Google Workspace OAuth for email integration.',
  },
  LABEL_BARTENDER: {
    config: '{\n  "baseUrl": "http://localhost:9001",\n  "authType": "NONE",\n  "timeout": 30000\n}',
    credentials: '{\n  "username": "",\n  "apiKey": ""\n}',
    hint: 'BarTender print server. authType: NONE, BASIC, or BEARER.',
  },
  LABEL_NICELABEL: {
    config: '{\n  "baseUrl": "https://api.nicelabel.cloud",\n  "authType": "BEARER",\n  "timeout": 30000\n}',
    credentials: '{\n  "apiKey": "ocp-apim-subscription-key"\n}',
    hint: 'NiceLabel Cloud API with subscription key authentication.',
  },
  LABEL_QZ_TRAY: {
    config: '{\n  "baseUrl": "http://localhost:8182",\n  "timeout": 30000\n}',
    credentials: '{}',
    hint: 'QZ Tray runs client-side in the browser. No server credentials needed.',
  },
  STORAGE_SQL: {
    config: '{\n  "tableName": "doc_FileStorage",\n  "maxFileSizeMB": 100,\n  "database": "softBITS_Storage",\n  "poolMax": "10",\n  "poolMin": "2"\n}',
    credentials: '{\n  "server": "192.168.100.30",\n  "user": "storage_user",\n  "password": "storage_password",\n  "port": 1433\n}',
    hint: 'SQL Server VARBINARY storage. Credentials optional — uses default pool if omitted.',
  },
  STORAGE_AZURE: {
    config: '{\n  "connectionString": "DefaultEndpointsProtocol=https;AccountName=...",\n  "containerName": "documents"\n}',
    credentials: '{}',
    hint: 'Azure Blob Storage. Connection string contains the credentials.',
  },
  EXCHANGE_RATE_API: {
    config: '{\n  "apiUrl": "https://api.exchangerate-api.com/v4/latest",\n  "baseCurrency": "AUD"\n}',
    credentials: '{\n  "apiKey": "your-api-key"\n}',
    hint: 'External exchange rate data provider for currency conversion.',
  },
  AI_ANTHROPIC: {
    config: '{\n  "model": "claude-sonnet-4-20250514",\n  "maxTokens": 4096\n}',
    credentials: '{\n  "apiKey": "sk-ant-v1-..."\n}',
    hint: 'Anthropic Claude models for document processing and AI features.',
  },
  AI_OPENAI: {
    config: '{\n  "model": "gpt-4",\n  "maxTokens": 4096\n}',
    credentials: '{\n  "apiKey": "sk-proj-..."\n}',
    hint: 'OpenAI GPT models.',
  },
  AI_OLLAMA: {
    config: '{\n  "baseUrl": "http://localhost:11434",\n  "model": "llama2",\n  "timeout": 120000\n}',
    credentials: '{}',
    hint: 'Local Ollama instance. No credentials needed for local models.',
  },
  AI_LMSTUDIO: {
    config: '{\n  "baseUrl": "http://localhost:1234",\n  "model": "default",\n  "timeout": 120000\n}',
    credentials: '{}',
    hint: 'Local LM Studio instance. No credentials needed for local models.',
  },
  AI_VLLM: {
    config: '{\n  "baseUrl": "http://localhost:8000",\n  "model": "default",\n  "timeout": 120000\n}',
    credentials: '{\n  "apiKey": "vllm-api-key"\n}',
    hint: 'vLLM high-throughput inference server. API key optional depending on config.',
  },
  ERP_SYSPRO: {
    config: '{\n  "baseUrl": "http://syspro-server:30001",\n  "company": "S",\n  "companyPassword": "",\n  "timeout": 30000\n}',
    credentials: '{\n  "operator": "ADMIN",\n  "operatorPassword": "password"\n}',
    hint: 'SYSPRO ERP integration via e.net SOAP/XML services.',
  },
  ERP_ACUMATICA: {
    config: '{\n  "baseUrl": "https://acumatica.company.com",\n  "company": "Company",\n  "branch": "MAIN",\n  "timeout": 30000\n}',
    credentials: '{\n  "username": "admin",\n  "password": "password"\n}',
    hint: 'Acumatica ERP integration via REST API.',
  },
  AUTOMATION_N8N: {
    config: '{\n  "baseUrl": "http://n8n.softbits.com.au",\n  "webhookPath": "/webhook",\n  "timeout": 30000\n}',
    credentials: '{\n  "apiKey": "n8n-api-key"\n}',
    hint: 'N8N workflow automation platform for event processing.',
  },
  INTERNAL_INFUSE_MCP: {
    config: '{\n  "serviceHost": "infuse-mcp",\n  "servicePort": 3900,\n  "healthEndpoint": "/health",\n  "oauth": {\n    "enabled": true,\n    "scopes": ["mcp:call_tool", "mcp:read_resource"],\n    "resourceUri": "https://mcp.greenbitshome.com"\n  },\n  "ipWhitelist": []\n}',
    credentials: '{}',
    hint: 'MCP tool server for AI assistants. Internal Docker service.',
  },
  INTERNAL_INFUSE_APP: {
    config: '{\n  "serviceHost": "infuse-app",\n  "servicePort": 3910,\n  "healthEndpoint": "/health",\n  "oauth": {\n    "enabled": true,\n    "scopes": ["mcp:call_tool"],\n    "resourceUri": "https://mcp.greenbitshome.com"\n  },\n  "ipWhitelist": []\n}',
    credentials: '{}',
    hint: 'Application AI integration service. Internal Docker service.',
  },
  INTERNAL_INFUSE_HTTP: {
    config: '{\n  "serviceHost": "infuse-http",\n  "servicePort": 3980,\n  "healthEndpoint": "/health"\n}',
    credentials: '{}',
    hint: 'REST API proxy for N8N workflows. Unauthenticated internal Docker service.',
  },
  INTERNAL_INFUSE_WORK: {
    config: '{\n  "serviceHost": "infuse-work",\n  "servicePort": 3990,\n  "healthEndpoint": "/health",\n  "oauth": {\n    "enabled": false\n  },\n  "ipWhitelist": []\n}',
    credentials: '{}',
    hint: 'Workflow management service. Internal Docker service.',
  },
  OAUTH_SERVER: {
    config: '{\n  "issuer": "https://mcp.greenbitshome.com",\n  "accessTokenTtl": 3600,\n  "refreshTokenTtl": 604800,\n  "authCodeTtl": 600,\n  "allowedCallbackUrls": [\n    "https://claude.ai/api/mcp/auth_callback"\n  ],\n  "mcpResourceUri": "https://mcp.greenbitshome.com"\n}',
    credentials: '{}',
    hint: 'Built-in OAuth 2.1 authorization server. RSA keys managed via environment.',
  },
};

/** Provider type display names for help panel */
const PROVIDER_TYPE_LABELS: Record<string, string> = {
  EMAIL_SMTP: 'SMTP Email',
  EMAIL_OAUTH_MICROSOFT: 'Microsoft 365 OAuth',
  EMAIL_OAUTH_GOOGLE: 'Google Workspace OAuth',
  LABEL_BARTENDER: 'BarTender',
  LABEL_NICELABEL: 'NiceLabel',
  LABEL_QZ_TRAY: 'QZ Tray',
  STORAGE_SQL: 'SQL Server Storage',
  STORAGE_AZURE: 'Azure Blob Storage',
  EXCHANGE_RATE_API: 'Exchange Rate API',
  AI_ANTHROPIC: 'Anthropic Claude',
  AI_OPENAI: 'OpenAI GPT',
  AI_OLLAMA: 'Ollama (Local)',
  AI_LMSTUDIO: 'LM Studio (Local)',
  AI_VLLM: 'vLLM Server',
  ERP_SYSPRO: 'SYSPRO ERP',
  ERP_ACUMATICA: 'Acumatica ERP',
  AUTOMATION_N8N: 'N8N Automation',
  OAUTH_SERVER: 'OAuth 2.1 Server',
};

/** Categories excluded from help panel */
const HELP_EXCLUDED_PREFIXES = ['INTERNAL_'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProviderEditModal({
  isOpen,
  onClose,
  provider,
  isEditing,
  providerTypes,
  form,
  onFormChange,
  onSave,
  isSaving,
  appConflicts,
  jsonErrors,
  onValidateJson,
  onToggleApp,
}: ProviderEditModalProps) {
  const [modalTab, setModalTab] = useState<string>('general');

  // Reset to general tab when modal opens
  useEffect(() => {
    if (isOpen) setModalTab('general');
  }, [isOpen]);

  const modalTabs: TabItem[] = [
    { id: 'general', label: 'General', icon: <Settings className="w-3.5 h-3.5" /> },
    ...(isEditing ? [{ id: 'api', label: 'API', icon: <Plug className="w-3.5 h-3.5" /> }] : []),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Provider' : 'Add Provider'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          {modalTab === 'general' && (
            <Button onClick={onSave} loading={isSaving}>
              {isEditing ? 'Save Changes' : 'Add Provider'}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {/* Modal tabs */}
        {isEditing && (
          <Tabs tabs={modalTabs} activeTab={modalTab} onChange={setModalTab} size="sm" />
        )}

        {/* General Tab */}
        {modalTab === 'general' && (
          <GeneralTab
            form={form}
            onFormChange={onFormChange}
            isEditing={isEditing}
            providerTypes={providerTypes}
            appConflicts={appConflicts}
            jsonErrors={jsonErrors}
            onValidateJson={onValidateJson}
            onToggleApp={onToggleApp}
          />
        )}

        {/* API Tab */}
        {modalTab === 'api' && provider && (
          <ApiTab provider={provider} />
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// General Tab
// ---------------------------------------------------------------------------

function GeneralTab({
  form,
  onFormChange,
  isEditing,
  providerTypes,
  appConflicts,
  jsonErrors,
  onValidateJson,
  onToggleApp,
}: {
  form: ProviderForm;
  onFormChange: (form: ProviderForm) => void;
  isEditing: boolean;
  providerTypes: ProviderType[];
  appConflicts: Record<string, string>;
  jsonErrors: { config?: string; creds?: string };
  onValidateJson: (value: string, field: 'config' | 'creds') => boolean;
  onToggleApp: (appCode: string) => void;
}) {
  const examples = PROVIDER_EXAMPLES[form.providerTypeCode] || null;
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpExpanded, setHelpExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Help panel toggle */}
      <button
        type="button"
        onClick={() => setHelpOpen(!helpOpen)}
        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary-400 transition-colors"
      >
        <HelpCircle className="w-3.5 h-3.5" />
        Configuration &amp; Credentials Reference
        {helpOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {helpOpen && (
        <div className="border border-border rounded-lg bg-surface-subtle p-3 space-y-1 max-h-64 overflow-y-auto">
          {Object.entries(PROVIDER_EXAMPLES)
            .filter(([code]) => !HELP_EXCLUDED_PREFIXES.some((p) => code.startsWith(p)))
            .map(([code, ex]) => (
              <div key={code} className="border-b border-border/50 last:border-0">
                <button
                  type="button"
                  onClick={() => setHelpExpanded(helpExpanded === code ? null : code)}
                  className="flex items-center justify-between w-full py-1.5 text-left text-xs font-medium text-semantic-text-secondary hover:text-semantic-text-primary"
                >
                  <span>{PROVIDER_TYPE_LABELS[code] || code}</span>
                  {helpExpanded === code ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {helpExpanded === code && (
                  <div className="pb-2 space-y-2">
                    <p className="text-[10px] text-semantic-text-faint">{ex.hint}</p>
                    <div>
                      <span className="text-[10px] font-semibold text-semantic-text-subtle uppercase tracking-wide">Configuration</span>
                      <pre className="mt-0.5 p-2 rounded bg-dark-100 text-[10px] font-mono text-semantic-text-secondary overflow-x-auto">{ex.config}</pre>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-semantic-text-subtle uppercase tracking-wide">Credentials</span>
                      <pre className="mt-0.5 p-2 rounded bg-dark-100 text-[10px] font-mono text-semantic-text-secondary overflow-x-auto">{ex.credentials}</pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Provider Type */}
      {!isEditing && (
        <FormField label="Provider Type" required>
          <select
            value={form.providerTypeCode}
            onChange={(e) => onFormChange({ ...form, providerTypeCode: e.target.value })}
            className="form-input"
            title="Provider type"
          >
            <option value="">-- Select Type --</option>
            {providerTypes.map((t) => (
              <option key={t.TypeCode} value={t.TypeCode}>
                {t.DisplayName}
              </option>
            ))}
          </select>
        </FormField>
      )}
      {isEditing && (
        <FormField label="Provider Type">
          <input
            type="text"
            value={providerTypes.find((t) => t.TypeCode === form.providerTypeCode)?.DisplayName || form.providerTypeCode}
            className="form-input"
            disabled
          />
        </FormField>
      )}

      {/* Scope */}
      <FormField label="Scope">
        <select
          value={form.scope}
          onChange={(e) => onFormChange({ ...form, scope: e.target.value as 'internal' | 'external' })}
          className="form-input"
          title="Provider scope"
        >
          <option value="external">External</option>
          <option value="internal">Internal</option>
        </select>
        <p className="text-[10px] text-semantic-text-faint mt-1">
          {form.scope === 'internal' ? (
            <span className="flex items-center gap-1"><Server className="w-3 h-3" /> Internal services run within the Docker network</span>
          ) : (
            <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> External services connect from outside the network</span>
          )}
        </p>
      </FormField>

      {/* Name */}
      <FormField label="Name" required>
        <input
          type="text"
          value={form.name}
          onChange={(e) => onFormChange({ ...form, name: e.target.value })}
          className="form-input"
          placeholder="My Provider"
        />
      </FormField>

      {/* Description */}
      <FormField label="Description">
        <input
          type="text"
          value={form.description}
          onChange={(e) => onFormChange({ ...form, description: e.target.value })}
          className="form-input"
          placeholder="Optional description"
        />
      </FormField>

      {/* Provider type hint */}
      {examples?.hint && (
        <p className="text-xs text-semantic-text-faint mb-3 flex items-start gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {examples.hint}
        </p>
      )}

      {/* Configuration JSON */}
      <FormField label={
        <span className="flex items-center">
          Configuration
          {!isEditing && examples?.config && form.configuration === '{}' && (
            <button
              type="button"
              onClick={() => onFormChange({ ...form, configuration: examples.config })}
              className="text-[10px] text-primary hover:text-primary-400 ml-2"
            >
              Use example
            </button>
          )}
        </span>
      } error={jsonErrors.config}>
        <textarea
          value={form.configuration}
          onChange={(e) => {
            onFormChange({ ...form, configuration: e.target.value });
            onValidateJson(e.target.value, 'config');
          }}
          className="form-input font-mono text-xs"
          rows={5}
          placeholder={examples?.config || '{}'}
        />
      </FormField>

      {/* Credentials JSON */}
      <FormField label={
        <span className="flex items-center">
          Credentials (encrypted on save)
          {!isEditing && examples?.credentials && form.credentials === '{}' && (
            <button
              type="button"
              onClick={() => onFormChange({ ...form, credentials: examples.credentials })}
              className="text-[10px] text-primary hover:text-primary-400 ml-2"
            >
              Use example
            </button>
          )}
        </span>
      } error={jsonErrors.creds}>
        <textarea
          value={form.credentials}
          onChange={(e) => {
            onFormChange({ ...form, credentials: e.target.value });
            onValidateJson(e.target.value, 'creds');
          }}
          className="form-input font-mono text-xs"
          rows={4}
          placeholder={examples?.credentials || '{}'}
        />
      </FormField>

      {/* Application assignments */}
      <FormField label="Applications">
        <div className="flex flex-wrap gap-2">
          {APP_CODES.map((app) => (
            <label
              key={app}
              className="flex items-center gap-1.5 text-xs text-semantic-text-secondary cursor-pointer"
            >
              <input
                type="checkbox"
                checked={form.applications.includes(app)}
                onChange={() => onToggleApp(app)}
                className="rounded border-border bg-surface-subtle text-primary focus:ring-interactive-focus-ring"
              />
              {app}
              {appConflicts[app] && form.applications.includes(app) && (
                <span className="flex items-center gap-0.5 text-amber-400" title={`Already used by "${appConflicts[app]}"`}>
                  <AlertTriangle className="w-3 h-3" />
                </span>
              )}
            </label>
          ))}
        </div>
      </FormField>
    </div>
  );
}

// ---------------------------------------------------------------------------
// API Tab
// ---------------------------------------------------------------------------

function ApiTab({ provider }: { provider: Provider }) {
  const { data: apiData, isLoading } = useQuery({
    queryKey: ['admin', 'providers', provider.ProviderId, 'api-details'],
    queryFn: () => getProviderApiDetails(provider.ProviderId),
    enabled: !!provider.ProviderId,
  });

  const details: ProviderApiDetails | null = apiData?.data || null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (!details) {
    return (
      <div className="text-center py-8 text-semantic-text-faint text-sm">
        Unable to load API details
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Connection */}
      <Section title="Connection" icon={<ExternalLink className="w-3.5 h-3.5" />}>
        <InfoRow label="URL" value={details.connectionUrl || 'Not configured'} mono />
        {details.healthEndpoint && (
          <InfoRow label="Health" value={details.healthEndpoint} mono />
        )}
        {details.webhookPaths && details.webhookPaths.length > 0 && (
          <InfoRow label="Webhooks" value={details.webhookPaths.join(', ')} mono />
        )}
        <InfoRow label="Scope" value={
          <span className="flex items-center gap-1">
            {details.scope === 'internal' ? (
              <><Server className="w-3 h-3" /> Internal</>
            ) : (
              <><Globe className="w-3 h-3" /> External</>
            )}
          </span>
        } />
      </Section>

      {/* OAuth */}
      {details.oauth && (
        <Section title="OAuth" icon={<Shield className="w-3.5 h-3.5" />}>
          <InfoRow label="Enabled" value={
            details.oauth.enabled ? (
              <span className="flex items-center gap-1 text-success"><CheckCircle className="w-3 h-3" /> Yes</span>
            ) : (
              <span className="flex items-center gap-1 text-semantic-text-faint"><XCircle className="w-3 h-3" /> No</span>
            )
          } />
          {details.oauth.scopes.length > 0 && (
            <InfoRow label="Scopes" value={
              <div className="flex flex-wrap gap-1">
                {details.oauth.scopes.map((s) => (
                  <span key={s} className="inline-flex px-1.5 py-0.5 text-[10px] font-mono rounded bg-surface-subtle text-semantic-text-subtle">
                    {s}
                  </span>
                ))}
              </div>
            } />
          )}
          {details.oauth.resourceUri && (
            <InfoRow label="Resource URI" value={details.oauth.resourceUri} mono />
          )}
        </Section>
      )}

      {/* IP Whitelist */}
      <Section title="IP Whitelist" icon={<Shield className="w-3.5 h-3.5" />}>
        {details.ipWhitelist.length === 0 ? (
          <p className="text-xs text-semantic-text-faint">
            No IP restrictions configured. All IPs are allowed to request OAuth tokens for this provider.
          </p>
        ) : (
          <div className="space-y-1">
            {details.ipWhitelist.map((ip, i) => (
              <div key={i} className="flex items-center gap-2 text-xs font-mono text-semantic-text-secondary bg-surface-subtle rounded px-2 py-1">
                {ip}
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] text-semantic-text-faint mt-2">
          Edit the <code className="bg-surface-subtle px-1 rounded">ipWhitelist</code> array in the Configuration JSON (General tab) to add or remove allowed IPs/CIDRs.
        </p>
      </Section>

      {/* Test Results */}
      <Section title="Health" icon={<CheckCircle className="w-3.5 h-3.5" />}>
        <InfoRow label="Status" value={
          !details.lastTestStatus ? (
            <StatusBadge status="neutral" label="Not Tested" size="sm" />
          ) : details.lastTestStatus === 'ok' ? (
            <StatusBadge status="success" label="OK" size="sm" />
          ) : (
            <StatusBadge status="danger" label={details.lastTestStatus === 'warning' ? 'Warning' : 'Failed'} size="sm" />
          )
        } />
        {details.lastTestError && (
          <InfoRow label="Error" value={<span className="text-danger">{details.lastTestError}</span>} />
        )}
        {details.lastTestedAt && (
          <InfoRow label="Tested" value={new Date(details.lastTestedAt).toLocaleString()} />
        )}
        {details.lastUsedAt && (
          <InfoRow label="Last Used" value={new Date(details.lastUsedAt).toLocaleString()} />
        )}
      </Section>

      {/* Usage */}
      <Section title="Usage" icon={<Plug className="w-3.5 h-3.5" />}>
        <InfoRow label="Linked OAuth Clients" value={String(details.linkedOAuthClients)} />
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="flex items-center gap-1.5 text-xs font-semibold text-semantic-text-subtle mb-2 uppercase tracking-wider">
        {icon}
        {title}
      </h4>
      <div className="space-y-2 pl-0.5">
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3 text-xs">
      <span className="text-semantic-text-faint w-24 shrink-0">{label}</span>
      <span className={`text-semantic-text-secondary ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function FormField({ label, required, error, children }: { label: React.ReactNode; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-semantic-text-subtle mb-1">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  );
}
