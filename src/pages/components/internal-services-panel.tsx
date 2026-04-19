import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, Server, Globe, Wifi, WifiOff, RefreshCw, Copy, ExternalLink, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, StatusBadge, LoadingSpinner } from '@/components/shared';
import { getInternalServices, testProvider, getProviderApiDetails } from '@/services/admin-service';
import type { Provider, SystemService, OAuthServerInfo } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTtl(seconds: number): string {
  if (seconds >= 86400) return `${Math.round(seconds / 86400)} day${seconds >= 172800 ? 's' : ''}`;
  if (seconds >= 3600) return `${Math.round(seconds / 3600)} hour${seconds >= 7200 ? 's' : ''}`;
  if (seconds >= 60) return `${Math.round(seconds / 60)} minute${seconds >= 120 ? 's' : ''}`;
  return `${seconds} second${seconds !== 1 ? 's' : ''}`;
}

function getHealthStatus(provider: Provider): 'success' | 'danger' | 'neutral' {
  if (!provider.LastTestStatus) return 'neutral';
  if (provider.LastTestStatus === 'ok') return 'success';
  return 'danger';
}

function getHealthLabel(provider: Provider): string {
  if (!provider.LastTestStatus) return 'Not Tested';
  if (provider.LastTestStatus === 'ok') return 'OK';
  if (provider.LastTestStatus === 'warning') return 'Warning';
  return 'Failed';
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('Copied to clipboard'),
    () => toast.error('Failed to copy'),
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InternalServicesPanel() {
  const queryClient = useQueryClient();
  const [testingId, setTestingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'internal-services'],
    queryFn: getInternalServices,
  });

  const providers: Provider[] = data?.data?.providers || [];
  const systemServices: SystemService[] = data?.data?.systemServices || [];
  const oauthServer: OAuthServerInfo | null = data?.data?.oauthServer || null;

  const handleTest = useCallback(async (provider: Provider) => {
    setTestingId(provider.ProviderId);
    try {
      const result = await testProvider(provider.ProviderId);
      if (result.ok) {
        toast.success(result.message || 'Connection successful');
      } else {
        toast.error(result.message || 'Connection failed');
      }
      queryClient.invalidateQueries({ queryKey: ['admin', 'internal-services'] });
    } catch {
      toast.error('Connection test failed');
    } finally {
      setTestingId(null);
    }
  }, [queryClient]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. OAuth Server Card */}
      {oauthServer && <OAuthServerCard oauthServer={oauthServer} />}

      {/* 2. Provider Services */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-semantic-text-subtle">
          Internal Provider Services
          <span className="ml-2 text-semantic-text-faint">({providers.length})</span>
        </h3>

        {providers.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <Server className="w-10 h-10 mx-auto mb-3 text-semantic-text-faint" />
              <h3 className="text-lg font-medium text-semantic-text-primary mb-1">No Internal Providers</h3>
              <p className="text-sm text-semantic-text-faint">
                No internal provider services configured yet.
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {providers.map((provider) => (
              <ProviderCard
                key={provider.ProviderId}
                provider={provider}
                testingId={testingId}
                onTest={handleTest}
              />
            ))}
          </div>
        )}
      </div>

      {/* 3. System Services */}
      {systemServices.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-semantic-text-subtle">
            System Services
            <span className="ml-2 text-semantic-text-faint">({systemServices.length})</span>
          </h3>

          <div className="space-y-3">
            {systemServices.map((service) => (
              <SystemServiceCard key={service.key} service={service} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OAuth Server Card
// ---------------------------------------------------------------------------

function OAuthServerCard({ oauthServer }: { oauthServer: OAuthServerInfo }) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold text-semantic-text-default">OAuth 2.1 Authorization Server</h3>
        </div>
        <StatusBadge
          status={oauthServer.enabled ? 'success' : 'danger'}
          label={oauthServer.enabled ? 'Enabled' : 'Disabled'}
          size="sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Issuer */}
        <div>
          <label className="block text-xs font-medium text-semantic-text-faint mb-1">Issuer</label>
          <div className="px-3 py-2 text-sm font-mono rounded bg-surface-subtle text-semantic-text-secondary border border-transparent">
            {oauthServer.issuer}
          </div>
        </div>

        {/* Resource URI */}
        <div>
          <label className="block text-xs font-medium text-semantic-text-faint mb-1">Resource URI</label>
          <div className="px-3 py-2 text-sm font-mono rounded bg-surface-subtle text-semantic-text-secondary border border-transparent">
            {oauthServer.mcpResourceUri}
          </div>
        </div>
      </div>

      {/* Callback URLs */}
      <div>
        <label className="block text-xs font-medium text-semantic-text-faint mb-1">Callback URLs</label>
        <div className="space-y-1.5">
          {oauthServer.allowedCallbackUrls.map((url) => (
            <div key={url} className="flex items-center gap-2 px-3 py-1.5 text-sm font-mono rounded bg-surface-subtle text-semantic-text-secondary">
              <span className="truncate flex-1">{url}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(url)}
                className="p-1 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover transition-colors shrink-0"
                title="Copy URL"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Token TTLs */}
      <div>
        <label className="block text-xs font-medium text-semantic-text-faint mb-2">Token Lifetimes</label>
        <div className="flex flex-wrap gap-4">
          <TtlPill label="Access Token" seconds={oauthServer.accessTokenTtl} />
          <TtlPill label="Refresh Token" seconds={oauthServer.refreshTokenTtl} />
          <TtlPill label="Auth Code" seconds={oauthServer.authCodeTtl} />
        </div>
      </div>
    </div>
  );
}

function TtlPill({ label, seconds }: { label: string; seconds: number }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-semantic-text-subtle">
      <Clock className="w-3 h-3 text-semantic-text-faint" />
      <span className="text-semantic-text-faint">{label}:</span>
      <span className="font-medium">{formatTtl(seconds)}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider Card
// ---------------------------------------------------------------------------

function ProviderCard({
  provider,
  testingId,
  onTest,
}: {
  provider: Provider;
  testingId: string | null;
  onTest: (provider: Provider) => void;
}) {
  const config = provider.Configuration as Record<string, unknown> | null;
  const connectionUrl = config
    ? `http://${config.serviceHost || 'unknown'}:${config.servicePort || '?'}`
    : null;
  const healthEndpoint = config?.healthEndpoint as string | undefined;
  const oauth = config?.oauth as { enabled?: boolean; scopes?: string[]; resourceUri?: string } | undefined;
  const webhookPath = config?.webhookPath as string | undefined;
  const isTesting = testingId === provider.ProviderId;

  // Known webhook paths for WORK-type providers
  const isWorkType = provider.ProviderTypeCode?.includes('WORK');
  const effectiveWebhookPaths: string[] = [];
  if (webhookPath) effectiveWebhookPaths.push(webhookPath);
  if (isWorkType && !webhookPath) effectiveWebhookPaths.push('/webhook');

  return (
    <Card className={!provider.IsActive ? 'opacity-60' : ''}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-semantic-text-default truncate">
              {provider.Name}
            </h4>
            <p className="text-xs text-semantic-text-faint mt-0.5">
              {provider.TypeDisplayName || provider.ProviderTypeCode}
            </p>
          </div>
          <StatusBadge
            status={provider.IsActive ? 'success' : 'danger'}
            label={provider.IsActive ? 'Active' : 'Inactive'}
            size="sm"
          />
        </div>

        {/* Read-only fields */}
        <div className="space-y-2">
          {connectionUrl && (
            <ReadOnlyField label="Connection URL" value={connectionUrl} mono />
          )}
          {healthEndpoint && (
            <ReadOnlyField label="Health Endpoint" value={healthEndpoint} mono />
          )}
          <ReadOnlyField
            label="Scope"
            value={
              <span className="flex items-center gap-1">
                {provider.Scope === 'internal' ? (
                  <><Server className="w-3 h-3" /> Internal</>
                ) : (
                  <><Globe className="w-3 h-3" /> External</>
                )}
              </span>
            }
          />
        </div>

        {/* OAuth section */}
        {oauth && (
          <div className="pt-2 border-t border-border space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-semantic-text-faint" />
              <span className="text-xs font-medium text-semantic-text-subtle">OAuth</span>
              <StatusBadge
                status={oauth.enabled ? 'success' : 'neutral'}
                label={oauth.enabled ? 'Enabled' : 'Disabled'}
                size="sm"
              />
            </div>
            {oauth.scopes && oauth.scopes.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {oauth.scopes.map((scope) => (
                  <span
                    key={scope}
                    className="inline-flex px-1.5 py-0.5 text-[10px] font-mono rounded bg-surface-subtle text-semantic-text-subtle"
                  >
                    {scope}
                  </span>
                ))}
              </div>
            )}
            {oauth.resourceUri && (
              <ReadOnlyField label="Resource URI" value={oauth.resourceUri} mono />
            )}
          </div>
        )}

        {/* Webhook paths */}
        {effectiveWebhookPaths.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs font-medium text-semantic-text-faint">Webhook Paths</span>
            {effectiveWebhookPaths.map((path) => (
              <div key={path} className="px-3 py-1.5 text-xs font-mono rounded bg-surface-subtle text-semantic-text-secondary cursor-not-allowed">
                {path}
              </div>
            ))}
          </div>
        )}

        {/* Health + Test Connection */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-semantic-text-faint">
            <StatusBadge
              status={getHealthStatus(provider)}
              label={getHealthLabel(provider)}
              size="sm"
            />
            {provider.LastTestedAt && (
              <span>
                {new Date(provider.LastTestedAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onTest(provider)}
            disabled={isTesting}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-semantic-text-subtle hover:text-primary rounded-lg hover:bg-interactive-hover transition-colors disabled:opacity-50"
            title="Test Connection"
          >
            {isTesting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : provider.LastTestStatus === 'ok' ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            Test
          </button>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// System Service Card
// ---------------------------------------------------------------------------

function SystemServiceCard({ service }: { service: SystemService }) {
  const typeLabel = service.type === 'BRIDGE_MODE' ? 'Container' : 'Background Service';

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface-raised px-4 py-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-semantic-text-default">{service.name}</h4>
          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-surface-subtle text-semantic-text-faint">
            {typeLabel}
          </span>
        </div>
        {service.description && (
          <p className="text-xs text-semantic-text-faint">{service.description}</p>
        )}
        {(service.connectionUrl || service.healthEndpoint) && (
          <div className="flex items-center gap-3 text-[11px] font-mono text-semantic-text-faint mt-1">
            {service.connectionUrl && (
              <span className="flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />
                {service.connectionUrl}
              </span>
            )}
            {service.healthEndpoint && (
              <span>{service.healthEndpoint}</span>
            )}
          </div>
        )}
      </div>
      <StatusBadge
        status={service.enabled ? 'success' : 'neutral'}
        label={service.status || (service.enabled ? 'Enabled' : 'Disabled')}
        size="sm"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function ReadOnlyField({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-semantic-text-faint mb-0.5">{label}</label>
      <div className={`px-3 py-1.5 text-xs rounded bg-surface-subtle text-semantic-text-secondary border border-transparent cursor-not-allowed ${mono ? 'font-mono' : ''}`}>
        {value}
      </div>
    </div>
  );
}
