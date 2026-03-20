import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  Key,
  Users,
  BarChart3,
  CheckCircle,
  Copy,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, Tabs, StatusBadge, LoadingSpinner, Modal, PageHeader } from '@/components/shared';
import type { TabItem } from '@/components/shared';
import type { LicenseModule, LicenseUser, ComplianceData } from '@/types';
import {
  getLicense,
  validateLicense,
  getLicenseUsage,
  getLicenseModules,
  getLicenseUsers,
  getLicenseUsersSummary,
  uploadLicense,
  getLicenseCompliance,
} from '@/services/admin-service';

// ===== Constants =====

const tabs: TabItem[] = [
  { id: 'subscription', label: 'Subscription', icon: <Key className="w-4 h-4" /> },
  { id: 'modules', label: 'Modules', icon: <Shield className="w-4 h-4" /> },
  { id: 'compliance', label: 'Compliance', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
];

const MODULE_FIELD_LABELS: Record<string, string> = {
  maxConcurrentUsers: 'Concurrent Users',
  maxNamedUsers: 'Named Users',
  maxWarehouses: 'Warehouses',
  maxTerminals: 'Terminals',
  maxVans: 'Vans',
  infuseMcpEnabled: 'MCP',
  infuseN8nEnabled: 'N8N',
  infuseQueryTier: 'Query Tier',
  maxQueriesPerMonth: 'Queries/Month',
};

// ===== Helpers =====

function maskLicenseKey(key: string): string {
  if (!key) return '-';
  const parts = key.split('-');
  if (parts.length !== 5) return key.substring(0, 10) + '...';
  return `${parts[0]}-${parts[1]}-****-****-${parts[4]}`;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
}

function getDaysColor(days: number | undefined | null): string {
  if (days === undefined || days === null) return 'text-semantic-text-subtle';
  if (days < 0) return 'text-danger';
  if (days < 30) return 'text-warning';
  return 'text-success';
}

function getStatusBadge(status?: string): { status: 'success' | 'warning' | 'danger' | 'neutral'; label: string } {
  switch (status) {
    case 'active':
    case 'Active':
      return { status: 'success', label: 'Active' };
    case 'grace':
    case 'Grace':
      return { status: 'warning', label: 'Grace Period' };
    case 'expired':
    case 'Expired':
      return { status: 'danger', label: 'Expired' };
    default:
      return { status: 'neutral', label: status || 'Unknown' };
  }
}

function getComplianceStatusBadge(status: string): { status: 'success' | 'warning' | 'danger'; label: string } {
  switch (status) {
    case 'compliant':
      return { status: 'success', label: 'Compliant' };
    case 'warning':
      return { status: 'warning', label: 'Warning' };
    case 'over-limit':
      return { status: 'danger', label: 'Over Limit' };
    default:
      return { status: 'success', label: status };
  }
}

function getModuleDetails(mod: LicenseModule): string {
  const details: string[] = [];
  for (const [key, label] of Object.entries(MODULE_FIELD_LABELS)) {
    const value = (mod as Record<string, unknown>)[key];
    if (value === null || value === undefined) continue;
    if (value === true || value === 1) details.push(`${label}: Yes`);
    else if (value === false || value === 0) continue;
    else details.push(`${label}: ${value}`);
  }
  return details.join(', ') || '-';
}

// ===== Sub-components =====

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border-subtle last:border-b-0">
      <span className="text-sm text-semantic-text-faint">{label}</span>
      <span className="text-sm text-semantic-text-default font-medium">{children}</span>
    </div>
  );
}

function ComplianceCard({
  title,
  subtitle,
  count,
  max,
  status,
}: {
  title: string;
  subtitle?: string;
  count: number;
  max: number | null;
  status: string;
}) {
  const badge = getComplianceStatusBadge(status);
  const countText = max === null || max === undefined ? `${count}` : `${count} / ${max}`;
  const pct = max === null || max === undefined || max === 0 ? 0 : Math.min((count / max) * 100, 100);

  const barColor = pct > 90 ? 'bg-danger' : pct > 75 ? 'bg-warning' : 'bg-success';

  return (
    <div className="bg-surface-raised border border-border rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-semantic-text-default">{title}</p>
          {subtitle && <p className="text-xs text-semantic-text-faint mt-0.5">{subtitle}</p>}
        </div>
        <StatusBadge status={badge.status} label={badge.label} size="sm" />
      </div>
      <p className="text-2xl font-bold text-semantic-text-default mb-2">{countText}</p>
      {max !== null && max !== undefined && max > 0 && (
        <>
          <div className="h-1.5 bg-surface-subtle rounded-full overflow-hidden">
            <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-semantic-text-faint mt-1">{pct.toFixed(1)}% used</p>
        </>
      )}
    </div>
  );
}

// ===== Main Component =====

export default function LicensingPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('subscription');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [keyRevealed, setKeyRevealed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [licenseFileContent, setLicenseFileContent] = useState<string | null>(null);
  const [licenseFileName, setLicenseFileName] = useState<string | null>(null);

  // ===== Queries =====

  const { data: licenseData, isLoading: licenseLoading } = useQuery({
    queryKey: ['admin', 'license'],
    queryFn: getLicense,
  });

  const { data: modulesData } = useQuery({
    queryKey: ['admin', 'license', 'modules'],
    queryFn: getLicenseModules,
    enabled: activeTab === 'modules',
  });

  const { data: usageData } = useQuery({
    queryKey: ['admin', 'license', 'usage'],
    queryFn: getLicenseUsage,
    enabled: activeTab === 'subscription',
  });

  const { data: usersData } = useQuery({
    queryKey: ['admin', 'license', 'users'],
    queryFn: () => getLicenseUsers(),
    enabled: activeTab === 'users',
  });

  const { data: usersSummaryData } = useQuery({
    queryKey: ['admin', 'license', 'users-summary'],
    queryFn: getLicenseUsersSummary,
    enabled: activeTab === 'users',
  });

  const { data: complianceRaw, isLoading: complianceLoading } = useQuery({
    queryKey: ['admin', 'compliance'],
    queryFn: getLicenseCompliance,
    enabled: activeTab === 'compliance',
  });

  // ===== Mutations =====

  const validateMutation = useMutation({
    mutationFn: validateLicense,
    onSuccess: (data: any) => {
      if (data.success && data.validation?.valid) {
        toast.success(`License validated (source: ${data.validation.source || 'unknown'})`);
      } else {
        toast.error(data.error || data.validation?.error?.message || 'Validation failed');
      }
      queryClient.invalidateQueries({ queryKey: ['admin', 'license'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to validate license');
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (xml: string) => uploadLicense(xml),
    onSuccess: () => {
      toast.success('License uploaded successfully');
      setShowUploadModal(false);
      setLicenseFileContent(null);
      setLicenseFileName(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'license'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to upload license');
    },
  });

  // ===== Handlers =====

  const handleCopyKey = useCallback(() => {
    const key = licenseData?.licenseKey || licenseData?.license?.licenseKey;
    if (key) {
      navigator.clipboard.writeText(key);
      toast.success('License key copied');
    }
  }, [licenseData]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.xml')) {
      toast.error('Please select an XML license file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setLicenseFileContent(event.target?.result as string);
      setLicenseFileName(file.name);
    };
    reader.readAsText(file);
  }, []);

  const handleUpload = useCallback(() => {
    if (licenseFileContent) {
      uploadMutation.mutate(licenseFileContent);
    }
  }, [licenseFileContent, uploadMutation]);

  // ===== Derived Data =====

  const getValue = (key: string) => {
    const data = licenseData as any;
    if (!data) return undefined;
    return data[key] !== undefined ? data[key] : data.license?.[key];
  };

  const licenseKey = getValue('licenseKey') as string | undefined;
  const companyName = getValue('companyName') as string | undefined;
  const tier = getValue('tier') || getValue('licenseTier');
  const expiresAt = getValue('expiresAt') || getValue('expirationDate');
  const daysRemaining = getValue('daysRemaining') as number | undefined;
  const status = licenseData?.status || (licenseData as any)?.license?.status;
  const enforcementMode = getValue('enforcementMode') || (licenseData as any)?.enforcement || 'soft';
  const gracePeriodDays = getValue('gracePeriodDays');
  const contactName = getValue('contactName');
  const contactEmail = getValue('contactEmail');
  const backupContactName = getValue('backupContactName');
  const backupContactEmail = getValue('backupContactEmail');
  const issueDate = getValue('issueDate');
  const startDate = getValue('startDate');

  const modules: LicenseModule[] = licenseData?.modules || (modulesData as any)?.modules || [];
  const users: LicenseUser[] = (usersData as any)?.users || [];
  const summary = (usersSummaryData as any)?.summary;
  const compliance: ComplianceData | null = (complianceRaw as any)?.data || null;

  const statusBadge = getStatusBadge(status === 'active' ? 'Active' : status === 'grace' ? 'Grace' : status);

  // ===== Render =====

  if (licenseLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Licensing"
        description="Manage license subscriptions and entitlements"
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              icon={<Upload className="w-3.5 h-3.5" />}
              onClick={() => setShowUploadModal(true)}
            >
              Upload License
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={() => validateMutation.mutate()}
              loading={validateMutation.isPending}
            >
              Validate
            </Button>
          </>
        }
      />

      {/* Status Bar */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 p-4 bg-surface-raised border border-border rounded-xl">
        <div>
          <p className="text-xs text-semantic-text-faint mb-1">Status</p>
          <StatusBadge status={statusBadge.status} label={statusBadge.label} size="sm" />
        </div>
        <div>
          <p className="text-xs text-semantic-text-faint mb-1">Tier</p>
          <p className="text-sm font-medium text-semantic-text-default">{tier || '-'}</p>
        </div>
        <div>
          <p className="text-xs text-semantic-text-faint mb-1">Expiration</p>
          <p className="text-sm font-medium text-semantic-text-default">{expiresAt ? formatDate(expiresAt) : 'Perpetual'}</p>
        </div>
        <div>
          <p className="text-xs text-semantic-text-faint mb-1">Days Remaining</p>
          <p className={`text-sm font-semibold ${getDaysColor(daysRemaining)}`}>
            {daysRemaining !== undefined && daysRemaining !== null
              ? daysRemaining < 0 ? `${Math.abs(daysRemaining)} overdue` : `${daysRemaining} days`
              : expiresAt ? '-' : 'Unlimited'}
          </p>
        </div>
        <div>
          <p className="text-xs text-semantic-text-faint mb-1">Active Users</p>
          <p className="text-sm font-medium text-semantic-text-default">{(licenseData as any)?.activeUsers ?? 0}</p>
        </div>
        <div>
          <p className="text-xs text-semantic-text-faint mb-1">Sessions</p>
          <p className="text-sm font-medium text-semantic-text-default">{(licenseData as any)?.activeSessions ?? 0}</p>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab: Subscription */}
      {activeTab === 'subscription' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="License Details">
            <div className="space-y-0">
              <DetailRow label="Company">{companyName || '-'}</DetailRow>
              <DetailRow label="Tier">{tier || '-'}</DetailRow>
              <DetailRow label="Issue Date">{formatDate(issueDate)}</DetailRow>
              <DetailRow label="Start Date">{formatDate(startDate)}</DetailRow>
              <DetailRow label="Expiration">{expiresAt ? formatDate(expiresAt) : 'Perpetual'}</DetailRow>
              <DetailRow label="Grace Period">{gracePeriodDays ? `${gracePeriodDays} days` : '-'}</DetailRow>
              <DetailRow label="Enforcement">
                {enforcementMode === 'hard' ? (
                  <StatusBadge status="danger" label="Hard Block" size="sm" />
                ) : (
                  <StatusBadge status="warning" label="Soft Warning" size="sm" />
                )}
              </DetailRow>
            </div>
          </Card>

          <Card title="Contact Information">
            <div className="space-y-0">
              <DetailRow label="Primary Contact">
                {contactName ? `${contactName}${contactEmail ? ` (${contactEmail})` : ''}` : '-'}
              </DetailRow>
              <DetailRow label="Backup Contact">
                {backupContactName ? `${backupContactName}${backupContactEmail ? ` (${backupContactEmail})` : ''}` : '-'}
              </DetailRow>
            </div>
          </Card>

          <Card title="License Key" className="lg:col-span-2">
            <div className="flex items-center gap-3">
              <code className="flex-1 font-mono text-sm bg-surface-overlay border border-border rounded-lg p-3 text-semantic-text-secondary select-all">
                {licenseKey
                  ? keyRevealed ? licenseKey : maskLicenseKey(licenseKey)
                  : '-'}
              </code>
              {licenseKey && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setKeyRevealed(!keyRevealed)}>
                    {keyRevealed ? 'Hide' : 'Reveal'}
                  </Button>
                  <Button variant="ghost" size="sm" icon={<Copy className="w-3.5 h-3.5" />} onClick={handleCopyKey}>
                    Copy
                  </Button>
                </>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Tab: Modules */}
      {activeTab === 'modules' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.length === 0 ? (
            <div className="col-span-full text-center py-12 text-sm text-semantic-text-faint">
              No module entitlements found
            </div>
          ) : (
            modules.map((mod) => {
              const isEnabled = mod.enabled === true || (mod.enabled as any) === 1;
              return (
                <div
                  key={mod.code}
                  className="bg-surface-raised border border-border rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-semantic-text-default">{mod.name || mod.code}</p>
                      <p className="text-xs text-semantic-text-faint font-mono">{mod.code}</p>
                    </div>
                    <StatusBadge
                      status={isEnabled ? 'success' : 'neutral'}
                      label={isEnabled ? 'Enabled' : 'Disabled'}
                      size="sm"
                    />
                  </div>
                  <p className="text-xs text-semantic-text-subtle leading-relaxed">{getModuleDetails(mod)}</p>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab: Compliance */}
      {activeTab === 'compliance' && (
        <div className="space-y-6">
          {complianceLoading ? (
            <div className="text-center py-12"><LoadingSpinner size="md" /></div>
          ) : !compliance ? (
            <div className="text-center py-12 text-sm text-semantic-text-faint">
              Failed to load compliance data
            </div>
          ) : (
            <>
              {/* Overall Status */}
              <div className={`flex items-center gap-3 px-5 py-3 rounded-xl border ${
                compliance.overall === 'compliant'
                  ? 'bg-success/5 border-success/20'
                  : compliance.overall === 'warning'
                    ? 'bg-warning/5 border-warning/20'
                    : 'bg-danger/5 border-danger/20'
              }`}>
                <div className={`w-2.5 h-2.5 rounded-full ${
                  compliance.overall === 'compliant' ? 'bg-success' : compliance.overall === 'warning' ? 'bg-warning' : 'bg-danger'
                }`} />
                <span className={`text-sm font-semibold ${
                  compliance.overall === 'compliant' ? 'text-success' : compliance.overall === 'warning' ? 'text-warning' : 'text-danger'
                }`}>
                  Overall: {compliance.overall === 'over-limit' ? 'Over Limit' : compliance.overall === 'warning' ? 'Warning' : 'Compliant'}
                </span>
              </div>

              {/* Usage Cards */}
              <div>
                <p className="text-xs text-semantic-text-faint font-semibold uppercase tracking-wider mb-3">Usage</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  <ComplianceCard
                    title="Named Users"
                    subtitle="Active users vs licensed"
                    count={compliance.users.activeCount}
                    max={compliance.users.maxNamed}
                    status={compliance.users.status}
                  />
                  {compliance.concurrent && Object.entries(compliance.concurrent).map(([code, info]) => (
                    info.maxAllowed ? (
                      <ComplianceCard
                        key={code}
                        title={`${code} Sessions`}
                        subtitle="Concurrent users"
                        count={info.activeCount}
                        max={info.maxAllowed}
                        status={info.status}
                      />
                    ) : null
                  ))}
                  {compliance.devices && Object.entries(compliance.devices).map(([app, info]) => (
                    <ComplianceCard
                      key={app}
                      title={`${app} Devices`}
                      subtitle={info.entitlement || 'Devices'}
                      count={info.activeCount}
                      max={info.maxAllowed}
                      status={info.status}
                    />
                  ))}
                  <ComplianceCard
                    title="Warehouses"
                    subtitle="Active vs licensed"
                    count={compliance.warehouses.activeCount}
                    max={compliance.warehouses.maxAllowed}
                    status={compliance.warehouses.status}
                  />
                </div>
              </div>

              {/* Module Entitlements Table */}
              {compliance.modules && compliance.modules.length > 0 && (
                <Card title="Module Entitlements">
                  <div className="overflow-x-auto -m-5">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-5 py-3 text-xs font-semibold text-semantic-text-faint uppercase">Module</th>
                          <th className="text-left px-3 py-3 text-xs font-semibold text-semantic-text-faint uppercase">Status</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-semantic-text-faint uppercase">Concurrent</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-semantic-text-faint uppercase">Named</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-semantic-text-faint uppercase">Terminals</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-semantic-text-faint uppercase">Warehouses</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-semantic-text-faint uppercase">Vans</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-semantic-text-faint uppercase">Kiosks</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-semantic-text-faint uppercase">Queries/Mo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {compliance.modules.map((mod) => (
                          <tr key={mod.code} className="border-b border-border-subtle">
                            <td className="px-5 py-3 font-medium text-semantic-text-default">{mod.name || mod.code}</td>
                            <td className="px-3 py-3">
                              <StatusBadge
                                status={mod.enabled ? 'success' : 'neutral'}
                                label={mod.enabled ? 'Enabled' : 'Disabled'}
                                size="sm"
                              />
                            </td>
                            <td className="text-center px-3 py-3 text-semantic-text-secondary">{mod.maxConcurrentUsers ?? <span className="text-semantic-text-disabled">&mdash;</span>}</td>
                            <td className="text-center px-3 py-3 text-semantic-text-secondary">{mod.maxNamedUsers ?? <span className="text-semantic-text-disabled">&mdash;</span>}</td>
                            <td className="text-center px-3 py-3 text-semantic-text-secondary">{mod.maxTerminals ?? <span className="text-semantic-text-disabled">&mdash;</span>}</td>
                            <td className="text-center px-3 py-3 text-semantic-text-secondary">{mod.maxWarehouses ?? <span className="text-semantic-text-disabled">&mdash;</span>}</td>
                            <td className="text-center px-3 py-3 text-semantic-text-secondary">{mod.maxVans ?? <span className="text-semantic-text-disabled">&mdash;</span>}</td>
                            <td className="text-center px-3 py-3 text-semantic-text-secondary">{mod.maxKiosks ?? <span className="text-semantic-text-disabled">&mdash;</span>}</td>
                            <td className="text-center px-3 py-3 text-semantic-text-secondary">{mod.maxQueriesPerMonth ?? <span className="text-semantic-text-disabled">&mdash;</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab: Users */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-surface-raised border border-border rounded-xl p-4">
                <p className="text-xs text-semantic-text-faint mb-1">Active Users</p>
                <p className="text-xl font-bold text-semantic-text-default">{summary.activeUsers ?? 0}</p>
              </div>
              <div className="bg-surface-raised border border-border rounded-xl p-4">
                <p className="text-xs text-semantic-text-faint mb-1">Active Sessions</p>
                <p className="text-xl font-bold text-semantic-text-default">{summary.totalActiveSessions ?? 0}</p>
              </div>
            </div>
          )}

          {/* Users Table */}
          <Card title="Licensed Users">
            {users.length === 0 ? (
              <div className="text-center py-12 text-sm text-semantic-text-faint">
                No licensed users configured
              </div>
            ) : (
              <div className="overflow-x-auto -m-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-semantic-text-faint uppercase">User</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-semantic-text-faint uppercase">Operator</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-semantic-text-faint uppercase">Type</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-semantic-text-faint uppercase">Modules</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-semantic-text-faint uppercase">Sessions</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-semantic-text-faint uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.Id} className="border-b border-border-subtle">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center text-xs font-bold text-semantic-text-on-primary">
                              {(user.DisplayName || user.SysproOperator || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-semantic-text-default">
                                {user.DisplayName || user.SysproOperator}
                              </p>
                              {user.Email && <p className="text-xs text-semantic-text-faint">{user.Email}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 font-mono text-semantic-text-secondary text-xs">{user.SysproOperator}</td>
                        <td className="px-3 py-3">
                          <StatusBadge status="info" label={user.UserType === 'named' ? 'Named' : user.UserType === 'concurrent' ? 'Concurrent' : user.UserType} size="sm" />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            {(user.AllowedModules || []).map((m) => (
                              <span key={m} className="px-1.5 py-0.5 text-xs bg-info/10 text-info rounded font-medium">{m}</span>
                            ))}
                            {(!user.AllowedModules || user.AllowedModules.length === 0) && (
                              <span className="text-xs text-semantic-text-faint">None</span>
                            )}
                          </div>
                        </td>
                        <td className="text-center px-3 py-3 text-sm text-semantic-text-secondary">
                          {user.CurrentSessions || 0} / {user.MaxSessions || 1}
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge
                            status={user.IsActive ? 'success' : 'neutral'}
                            label={user.IsActive ? 'Active' : 'Inactive'}
                            size="sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Upload License Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => { setShowUploadModal(false); setLicenseFileContent(null); setLicenseFileName(null); }}
        title="Upload License File"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowUploadModal(false); setLicenseFileContent(null); setLicenseFileName(null); }}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!licenseFileContent}
              loading={uploadMutation.isPending}
            >
              Upload
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-semantic-text-subtle">
            Select an XML license file to upload. This will replace the current license.
          </p>
          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-accent-primary transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-8 h-8 text-semantic-text-faint mx-auto mb-3" />
            <p className="text-sm text-semantic-text-subtle">Click to select a file or drag and drop</p>
            <p className="text-xs text-semantic-text-faint mt-1">XML files only</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml"
              className="hidden"
              onChange={handleFileSelect}
              aria-label="License file upload"
            />
          </div>
          {licenseFileName && (
            <div className="flex items-center gap-2 p-3 bg-surface-overlay rounded-lg">
              <CheckCircle className="w-4 h-4 text-success" />
              <span className="text-sm text-semantic-text-secondary flex-1">{licenseFileName}</span>
              <button
                type="button"
                onClick={() => { setLicenseFileContent(null); setLicenseFileName(null); }}
                className="text-semantic-text-faint hover:text-semantic-text-secondary"
                aria-label="Remove selected file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
