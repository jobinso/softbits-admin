import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiError } from '@/types';
import { Mail, Shield, Route, Activity, Plus, Edit3, Trash2, RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DataTable,
  Button,
  Card,
  Modal,
  Tabs,
  StatusBadge,
  LoadingSpinner,
  PageHeader,
  TableCard,
  PageStatusBar,
} from '@/components/shared';
import type { TabItem, ColumnDef } from '@/components/shared';
import { useModal } from '@shared/hooks';
import {
  getEmailPollerStatus,
  getEmailPollerPollerStatus,
  getEmailPollerRoutingRules,
  createEmailPollerRoutingRule,
  updateEmailPollerRoutingRule,
  deleteEmailPollerRoutingRule,
  getEmailPollerWorkflows,
  getEmailPollerSecurityEvents,
  getEmailPollerSecuritySummary,
  getEmailPollerCircuitBreakers,
  triggerEmailPoll,
} from '@/services/admin-service';

// ===== Types =====

interface RoutingRule {
  RuleId: string;
  ProviderId: string;
  Name: string;
  Description: string | null;
  Priority: number;
  IsActive: boolean;
  MatchRecipient: string | null;
  MatchRecipientPattern: string | null;
  MatchSubjectPattern: string | null;
  MatchSenderDomain: string | null;
  MatchSenderAddress: string | null;
  WorkflowCode: string;
  WorkflowConfig: string | null;
  CreatedAt: string;
  UpdatedAt: string;
}

interface SecurityEvent {
  EventId: number;
  EventType: string;
  Subject: string | null;
  SenderAddress: string | null;
  Filename: string | null;
  Reason: string;
  CreatedAt: string;
}

interface CircuitBreakerStatus {
  workflowCode: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  successes: number;
  failures: number;
  rejects: number;
  timeouts: number;
}

interface ProviderStatus {
  providerId: string;
  name: string;
  mailbox: string;
  folder: string;
  intervalMs: number;
  lastPollAt: string | null;
  lastPollStatus: string | null;
  lastError: string | null;
  rateLimit: { current: number };
  stats: Record<string, number> | null;
}

interface RuleForm {
  name: string;
  description: string;
  priority: number;
  isActive: boolean;
  matchRecipient: string;
  matchRecipientPattern: string;
  matchSubjectPattern: string;
  matchSenderDomain: string;
  matchSenderAddress: string;
  workflowCode: string;
}

const INITIAL_RULE_FORM: RuleForm = {
  name: '', description: '', priority: 100, isActive: true,
  matchRecipient: '', matchRecipientPattern: '', matchSubjectPattern: '',
  matchSenderDomain: '', matchSenderAddress: '', workflowCode: 'DOCUMENT_CAPTURE',
};

// ===== Tabs =====

const tabs: TabItem[] = [
  { id: 'status', label: 'Status', icon: <Activity className="w-4 h-4" /> },
  { id: 'routing', label: 'Routing Rules', icon: <Route className="w-4 h-4" /> },
  { id: 'security', label: 'Security Events', icon: <Shield className="w-4 h-4" /> },
];

// ===== Component =====

export default function EmailPollerAdminPage() {
  const [activeTab, setActiveTab] = useState('status');
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const queryClient = useQueryClient();

  // Status query
  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['email-poller-status'],
    queryFn: () => getEmailPollerStatus(),
    refetchInterval: 30000,
  });

  // Poller container reachability (only relevant in api/split mode)
  const { data: pollerStatusData } = useQuery({
    queryKey: ['email-poller-poller-status'],
    queryFn: () => getEmailPollerPollerStatus(),
    refetchInterval: 10000,
    retry: false,
  });
  const pollerRunning = pollerStatusData?.running !== false;

  const status = statusData?.data;
  const providers: ProviderStatus[] = status?.providers || [];

  // Auto-select first provider
  if (!selectedProvider && providers.length > 0) {
    setSelectedProvider(providers[0].providerId);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="PollIT"
        description="O365 mailbox polling, routing rules, and security monitoring"
        icon={<Mail className="w-6 h-6" />}
      />

      <PageStatusBar items={[
        { type: 'badge', label: 'Poller', status: pollerRunning ? 'success' : 'danger', badgeLabel: pollerRunning ? 'Running' : 'Offline' },
        { type: 'badge', label: 'Service', status: status?.isRunning ? 'success' : 'danger', badgeLabel: status?.isRunning ? 'Running' : 'Stopped' },
        { type: 'text', label: 'Providers', value: String(status?.providerCount || 0) },
        { type: 'badge', label: 'ClamAV', status: status?.clamav?.status === 'connected' ? 'success' : status?.clamav?.enabled ? 'warning' : 'neutral', badgeLabel: status?.clamav?.status === 'connected' ? 'Connected' : status?.clamav?.enabled ? 'Unavailable' : 'Disabled' },
        { type: 'badge', label: 'Virus Scan', status: status?.security?.scanVirus ? 'success' : 'neutral', badgeLabel: status?.security?.scanVirus ? 'On' : 'Off' },
        { type: 'badge', label: 'Block Macros', status: status?.security?.blockMacros ? 'success' : 'neutral', badgeLabel: status?.security?.blockMacros ? 'On' : 'Off' },
        { type: 'text', label: 'Max Attachment', value: `${status?.security?.maxAttachmentSizeMB || 25} MB` },
      ]} />

      {providers.length > 1 && (
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted">Provider:</label>
          <select
            className="input-field text-sm"
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
          >
            {providers.map(p => (
              <option key={p.providerId} value={p.providerId}>{p.name} ({p.mailbox})</option>
            ))}
          </select>
        </div>
      )}

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'status' && <StatusTab providers={providers} circuitBreakers={status?.circuitBreakers || []} clamav={status?.clamav} pollerRunning={pollerRunning} />}
      {activeTab === 'routing' && selectedProvider && <RoutingTab providerId={selectedProvider} />}
      {activeTab === 'security' && <SecurityTab providerId={selectedProvider} />}
    </div>
  );
}

// ===== Status Tab =====

interface ClamAvStatus {
  enabled: boolean;
  status: string;
  host: string | null;
  port: number | null;
}

function StatusTab({ providers, circuitBreakers, clamav, pollerRunning }: { providers: ProviderStatus[]; circuitBreakers: CircuitBreakerStatus[]; clamav?: ClamAvStatus; pollerRunning: boolean }) {
  const queryClient = useQueryClient();

  const triggerMutation = useMutation({
    mutationFn: (providerId?: string) => triggerEmailPoll(providerId),
    onSuccess: () => {
      toast.success('Poll triggered');
      queryClient.invalidateQueries({ queryKey: ['email-poller-status'] });
    },
    onError: (err: ApiError) => {
      toast.error(`Trigger failed: ${err.response?.data?.error || err.message}`);
    },
  });

  const providerColumns: ColumnDef<ProviderStatus>[] = [
    {
      key: 'name', label: 'Provider', sortable: true,
      render: (val) => <span className="font-medium text-semantic-text-default">{val}</span>,
    },
    {
      key: 'mailbox', label: 'Mailbox', sortable: true,
      render: (val) => <span className="text-semantic-text-secondary">{val}</span>,
    },
    {
      key: 'folder', label: 'Folder', width: 100,
      render: (val) => <span className="text-semantic-text-faint">{val}</span>,
    },
    {
      key: 'intervalMs', label: 'Interval', width: 100,
      render: (val) => <span className="text-semantic-text-faint">{val ? `${Math.round(Number(val) / 1000)}s` : '-'}</span>,
    },
    {
      key: 'lastPollStatus', label: 'Status', width: 110,
      render: (val) => {
        const statusMap: Record<string, 'success' | 'danger' | 'neutral'> = { success: 'success', error: 'danger' };
        return <StatusBadge status={statusMap[val] || 'neutral'} label={val || 'Never'} size="sm" />;
      },
    },
    {
      key: 'lastPollAt', label: 'Last Poll', width: 160,
      render: (val) => <span className="text-xs text-semantic-text-faint">{val ? new Date(val).toLocaleString() : '-'}</span>,
    },
    {
      key: 'rateLimit', label: 'Rate', width: 80,
      render: (val) => <span className="text-semantic-text-faint">{val?.current || 0}/min</span>,
    },
    {
      key: 'stats', label: 'Processed', width: 100,
      render: (val) => <span className="text-semantic-text-default">{val?.TotalProcessed?.toLocaleString() || '0'}</span>,
    },
    {
      key: 'providerId', label: 'Actions', width: 80, sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => triggerMutation.mutate(row.providerId)}
            disabled={!pollerRunning || triggerMutation.isPending}
            className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-semantic-text-faint disabled:hover:bg-transparent"
            title={pollerRunning ? 'Trigger Poll Now' : 'Poller service is offline'}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const breakerColumns: ColumnDef<CircuitBreakerStatus>[] = [
    {
      key: 'workflowCode', label: 'Workflow', sortable: true,
      render: (val) => <span className="font-medium text-semantic-text-default font-mono">{val}</span>,
    },
    {
      key: 'state', label: 'State', width: 110,
      render: (val) => {
        const statusMap: Record<string, 'success' | 'danger' | 'warning'> = { CLOSED: 'success', OPEN: 'danger', HALF_OPEN: 'warning' };
        return <StatusBadge status={statusMap[val] || 'neutral'} label={val} size="sm" />;
      },
    },
    { key: 'successes', label: 'Successes', width: 90 },
    { key: 'failures', label: 'Failures', width: 80 },
    { key: 'rejects', label: 'Rejected', width: 80 },
    { key: 'timeouts', label: 'Timeouts', width: 80 },
  ];

  return (
    <div className="space-y-6">
      <TableCard
        title="Providers"
        icon={<Mail className="w-4 h-4" />}
        count={providers.length}
      >
        <DataTable<ProviderStatus>
          id="pollit-providers"
          columns={providerColumns}
          data={providers}
          rowKey="providerId"
          emptyMessage="No email providers configured"
          emptyIcon={Mail}
          embedded
          showColumnPicker={false}
        />
      </TableCard>

      {clamav && (
        <Card>
          <div className="flex items-center gap-3 mb-3">
            <Shield className="w-4 h-4 text-semantic-text-faint" />
            <span className="text-sm font-medium text-semantic-text-default">ClamAV Antivirus</span>
            <StatusBadge
              status={clamav.status === 'connected' ? 'success' : clamav.enabled ? 'warning' : 'neutral'}
              label={clamav.status === 'connected' ? 'Connected' : clamav.enabled ? 'Unavailable' : 'Disabled'}
              size="sm"
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-semantic-text-faint text-xs">Enabled</span>
              <div className="font-medium text-semantic-text-default">{clamav.enabled ? 'Yes' : 'No'}</div>
            </div>
            <div>
              <span className="text-semantic-text-faint text-xs">Host</span>
              <div className="font-medium text-semantic-text-secondary font-mono">{clamav.host || '-'}</div>
            </div>
            <div>
              <span className="text-semantic-text-faint text-xs">Port</span>
              <div className="font-medium text-semantic-text-secondary font-mono">{clamav.port || '-'}</div>
            </div>
            <div>
              <span className="text-semantic-text-faint text-xs">Detail</span>
              <div className="font-medium text-semantic-text-default">{clamav.status === 'connected' ? 'Scanning active' : clamav.enabled ? 'Connection failed' : 'Virus scanning disabled'}</div>
            </div>
          </div>
        </Card>
      )}

      {circuitBreakers.length > 0 && (
        <TableCard
          title="Circuit Breakers"
          icon={<Activity className="w-4 h-4" />}
          count={circuitBreakers.length}
        >
          <DataTable<CircuitBreakerStatus>
            id="pollit-circuit-breakers"
            columns={breakerColumns}
            data={circuitBreakers}
            rowKey="workflowCode"
            embedded
            showColumnPicker={false}
          />
        </TableCard>
      )}
    </div>
  );
}

// ===== Routing Rules Tab =====

function RoutingTab({ providerId }: { providerId: string }) {
  const queryClient = useQueryClient();
  const { isOpen, open, close } = useModal();
  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null);
  const [form, setForm] = useState<RuleForm>(INITIAL_RULE_FORM);

  const { data: rulesData, isLoading } = useQuery({
    queryKey: ['email-poller-rules', providerId],
    queryFn: () => getEmailPollerRoutingRules(providerId),
    enabled: !!providerId,
  });

  const { data: workflowsData } = useQuery({
    queryKey: ['email-poller-workflows'],
    queryFn: () => getEmailPollerWorkflows(),
  });

  const rules: RoutingRule[] = rulesData?.data || [];
  const workflows: string[] = workflowsData?.data || [];

  const createMutation = useMutation({
    mutationFn: (rule: Record<string, unknown>) => createEmailPollerRoutingRule(rule),
    onSuccess: () => {
      toast.success('Rule created');
      queryClient.invalidateQueries({ queryKey: ['email-poller-rules'] });
      close();
    },
    onError: (err: Error) => toast.error(`Failed: ${err.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      updateEmailPollerRoutingRule(id, updates),
    onSuccess: () => {
      toast.success('Rule updated');
      queryClient.invalidateQueries({ queryKey: ['email-poller-rules'] });
      close();
    },
    onError: (err: Error) => toast.error(`Failed: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEmailPollerRoutingRule(id),
    onSuccess: () => {
      toast.success('Rule deleted');
      queryClient.invalidateQueries({ queryKey: ['email-poller-rules'] });
    },
    onError: (err: Error) => toast.error(`Failed: ${err.message}`),
  });

  const handleAdd = () => {
    setEditingRule(null);
    setForm(INITIAL_RULE_FORM);
    open();
  };

  const handleEdit = (rule: RoutingRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.Name,
      description: rule.Description || '',
      priority: rule.Priority,
      isActive: rule.IsActive,
      matchRecipient: rule.MatchRecipient || '',
      matchRecipientPattern: rule.MatchRecipientPattern || '',
      matchSubjectPattern: rule.MatchSubjectPattern || '',
      matchSenderDomain: rule.MatchSenderDomain || '',
      matchSenderAddress: rule.MatchSenderAddress || '',
      workflowCode: rule.WorkflowCode,
    });
    open();
  };

  const handleSave = () => {
    const payload = {
      providerId,
      name: form.name,
      description: form.description || null,
      priority: form.priority,
      isActive: form.isActive,
      matchRecipient: form.matchRecipient || null,
      matchRecipientPattern: form.matchRecipientPattern || null,
      matchSubjectPattern: form.matchSubjectPattern || null,
      matchSenderDomain: form.matchSenderDomain || null,
      matchSenderAddress: form.matchSenderAddress || null,
      workflowCode: form.workflowCode,
    };

    if (editingRule) {
      updateMutation.mutate({ id: editingRule.RuleId, updates: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const columns: ColumnDef<RoutingRule>[] = [
    {
      key: 'Priority', label: 'Priority', width: 80, sortable: true,
      render: (val) => <span className="font-mono text-semantic-text-faint">{val}</span>,
    },
    {
      key: 'Name', label: 'Name', sortable: true,
      render: (val) => <span className="font-medium text-semantic-text-default">{val}</span>,
    },
    {
      key: 'IsActive', label: 'Status', width: 100,
      render: (val) => <StatusBadge status={val ? 'success' : 'danger'} label={val ? 'Active' : 'Inactive'} size="sm" />,
    },
    {
      key: 'MatchRecipient', label: 'Match', render: (_val, row) => {
        const parts: string[] = [];
        if (row.MatchRecipient) parts.push(`To: ${row.MatchRecipient}`);
        if (row.MatchRecipientPattern) parts.push(`To: ${row.MatchRecipientPattern}`);
        if (row.MatchSubjectPattern) parts.push(`Subj: ${row.MatchSubjectPattern}`);
        if (row.MatchSenderDomain) parts.push(`Domain: ${row.MatchSenderDomain}`);
        if (row.MatchSenderAddress) parts.push(`From: ${row.MatchSenderAddress}`);
        return parts.length > 0
          ? <span className="text-semantic-text-secondary">{parts.join(', ')}</span>
          : <span className="text-semantic-text-faint">Catch-all</span>;
      },
    },
    {
      key: 'WorkflowCode', label: 'Workflow', width: 180, sortable: true,
      render: (val) => <span className="font-mono text-xs px-2 py-0.5 bg-info/10 text-info rounded-full">{val}</span>,
    },
    {
      key: 'RuleId', label: 'Actions', width: 80, sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => handleEdit(row)}
            className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover transition-colors"
            title="Edit Rule"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => { if (window.confirm(`Delete rule "${row.Name}"?`)) deleteMutation.mutate(row.RuleId); }}
            className="p-1.5 text-semantic-text-faint hover:text-danger rounded hover:bg-interactive-hover transition-colors"
            title="Delete Rule"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  if (isLoading) return <LoadingSpinner />;

  return (
    <>
      <TableCard
        title="Routing Rules"
        count={rules.length}
        headerActions={<Button size="sm" onClick={handleAdd}><Plus className="w-3 h-3 mr-1" /> Add Rule</Button>}
      >
        <DataTable<RoutingRule>
          id="pollit-routing-rules"
          columns={columns}
          data={rules}
          rowKey="RuleId"
          emptyMessage="No routing rules. All emails go to DOCUMENT_CAPTURE."
          embedded
          showColumnPicker={false}
        />
      </TableCard>

      <Modal
        isOpen={isOpen}
        onClose={close}
        title={editingRule ? `Edit: ${editingRule.Name}` : 'New Routing Rule'}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={!form.name || !form.workflowCode}
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editingRule ? 'Save' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          {/* General */}
          <div>
            <h4 className="text-xs font-semibold text-semantic-text-subtle uppercase tracking-wider mb-3">General</h4>
            <div className="grid grid-cols-3 gap-4">
              <FormField label="Name" required>
                <input type="text" className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Purchase Orders" />
              </FormField>
              <FormField label="Priority">
                <input type="number" className="form-input" value={form.priority} onChange={e => setForm({ ...form, priority: parseInt(e.target.value) || 100 })} />
              </FormField>
              <FormField label="Active">
                <ToggleField checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label={form.isActive ? 'Active' : 'Inactive'} />
              </FormField>
            </div>
            <div className="mt-3">
              <FormField label="Description">
                <input type="text" className="form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional description of this rule's purpose" />
              </FormField>
            </div>
          </div>

          {/* Match Conditions */}
          <div>
            <h4 className="text-xs font-semibold text-semantic-text-subtle uppercase tracking-wider mb-1">Match Conditions</h4>
            <p className="text-xs text-semantic-text-faint mb-3">All non-empty conditions must match (AND logic). Leave all empty for a catch-all rule.</p>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Recipient (exact)">
                <input type="text" className="form-input" value={form.matchRecipient} onChange={e => setForm({ ...form, matchRecipient: e.target.value })} placeholder="po@company.com" />
              </FormField>
              <FormField label="Recipient (pattern)">
                <input type="text" className="form-input" value={form.matchRecipientPattern} onChange={e => setForm({ ...form, matchRecipientPattern: e.target.value })} placeholder="*-po@company.com" />
              </FormField>
              <FormField label="Subject (contains / *glob*)">
                <input type="text" className="form-input" value={form.matchSubjectPattern} onChange={e => setForm({ ...form, matchSubjectPattern: e.target.value })} placeholder="*quote*" />
              </FormField>
              <FormField label="Sender Domain">
                <input type="text" className="form-input" value={form.matchSenderDomain} onChange={e => setForm({ ...form, matchSenderDomain: e.target.value })} placeholder="supplier.com" />
              </FormField>
              <FormField label="Sender Address (exact)">
                <input type="text" className="form-input" value={form.matchSenderAddress} onChange={e => setForm({ ...form, matchSenderAddress: e.target.value })} placeholder="orders@supplier.com" />
              </FormField>
            </div>
          </div>

          {/* Workflow */}
          <div>
            <h4 className="text-xs font-semibold text-semantic-text-subtle uppercase tracking-wider mb-3">Workflow</h4>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Workflow" required>
                <select className="form-input" value={form.workflowCode} onChange={e => setForm({ ...form, workflowCode: e.target.value })} title="Workflow">
                  {workflows.map(w => <option key={w} value={w}>{w}</option>)}
                  {workflows.length === 0 && <option value="DOCUMENT_CAPTURE">DOCUMENT_CAPTURE</option>}
                </select>
              </FormField>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ===== Security Events Tab =====

function SecurityTab({ providerId }: { providerId: string }) {
  const { data: eventsData, isLoading } = useQuery({
    queryKey: ['email-poller-security-events', providerId],
    queryFn: () => getEmailPollerSecurityEvents({ providerId: providerId || undefined, limit: 100 }),
    refetchInterval: 60000,
  });

  const { data: summaryData } = useQuery({
    queryKey: ['email-poller-security-summary', providerId],
    queryFn: () => getEmailPollerSecuritySummary({ providerId: providerId || undefined, days: 30 }),
  });

  const events: SecurityEvent[] = eventsData?.data || [];
  const summary: { EventType: string; Count: number }[] = summaryData?.data || [];

  const eventTypeIcon = (type: string) => {
    if (type.includes('VIRUS')) return <XCircle className="w-4 h-4 text-red-500" />;
    if (type.includes('BLOCKED')) return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    if (type.includes('SENDER')) return <Shield className="w-4 h-4 text-orange-500" />;
    if (type.includes('DMARC') || type.includes('SCL')) return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    return <Clock className="w-4 h-4 text-muted" />;
  };

  const eventColumns: ColumnDef<SecurityEvent>[] = [
    { key: 'EventType', label:'Type', render: (_v, row) => (
      <div className="flex items-center gap-2">
        {eventTypeIcon(row.EventType)}
        <span className="font-mono text-sm">{row.EventType}</span>
      </div>
    )},
    { key: 'Subject', label:'Subject', render: (_v, row) => (
      <span className="text-sm truncate max-w-xs block">{row.Subject || '-'}</span>
    )},
    { key: 'SenderAddress', label:'Sender', render: (_v, row) => <span className="text-sm">{row.SenderAddress || '-'}</span> },
    { key: 'Filename', label:'File', render: (_v, row) => <span className="text-sm font-mono">{row.Filename || '-'}</span> },
    { key: 'Reason', label:'Reason', render: (_v, row) => <span className="text-sm text-muted truncate max-w-sm block">{row.Reason}</span> },
    { key: 'CreatedAt', label:'Time', render: (_v, row) => (
      <span className="text-sm text-muted">{new Date(row.CreatedAt).toLocaleString()}</span>
    )},
  ];

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {summary.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {summary.map(s => (
            <Card key={s.EventType}>
              <div className="flex items-center gap-2 mb-1">
                {eventTypeIcon(s.EventType)}
                <span className="text-xs font-mono text-muted">{s.EventType}</span>
              </div>
              <div className="text-2xl font-bold">{s.Count}</div>
              <div className="text-xs text-muted">Last 30 days</div>
            </Card>
          ))}
        </div>
      )}

      <TableCard title="Recent Security Events" count={events.length}>
        <DataTable<SecurityEvent>
          id="pollit-security-events"
          columns={eventColumns}
          data={events}
          rowKey="EventId"
          emptyMessage="No security events recorded"
          embedded
          showColumnPicker={false}
        />
      </TableCard>
    </div>
  );
}

// ===== Form Helpers (matches PulpIT pattern) =====

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-semantic-text-subtle mb-1">
        {label}{required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function ToggleField({ checked, onChange, label }: { checked: boolean; onChange: (val: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer py-1">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-dark-200'}`}
      >
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
      </button>
      <span className="text-sm text-semantic-text-secondary">{label}</span>
    </label>
  );
}
