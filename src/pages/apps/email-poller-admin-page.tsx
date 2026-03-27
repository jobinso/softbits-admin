import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
        subtitle="O365 mailbox polling, routing rules, and security monitoring"
        icon={<Mail className="w-6 h-6" />}
      />

      <PageStatusBar items={[
        { label: 'Service', value: status?.isRunning ? 'Running' : 'Stopped', variant: status?.isRunning ? 'success' : 'error' },
        { label: 'Providers', value: String(status?.providerCount || 0) },
        { label: 'ClamAV', value: status?.clamav?.status === 'connected' ? 'Connected' : status?.clamav?.enabled ? 'Unavailable' : 'Disabled', variant: status?.clamav?.status === 'connected' ? 'success' : status?.clamav?.enabled ? 'warning' : 'neutral' },
        { label: 'Virus Scan', value: status?.security?.scanVirus ? 'On' : 'Off', variant: status?.security?.scanVirus ? 'success' : 'neutral' },
        { label: 'Block Macros', value: status?.security?.blockMacros ? 'On' : 'Off', variant: status?.security?.blockMacros ? 'success' : 'neutral' },
        { label: 'Max Attachment', value: `${status?.security?.maxAttachmentSizeMB || 25} MB` },
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

      {activeTab === 'status' && <StatusTab providers={providers} circuitBreakers={status?.circuitBreakers || []} clamav={status?.clamav} />}
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

function StatusTab({ providers, circuitBreakers, clamav }: { providers: ProviderStatus[]; circuitBreakers: CircuitBreakerStatus[]; clamav?: ClamAvStatus }) {
  const queryClient = useQueryClient();

  const triggerMutation = useMutation({
    mutationFn: (providerId?: string) => triggerEmailPoll(providerId),
    onSuccess: () => {
      toast.success('Poll triggered');
      queryClient.invalidateQueries({ queryKey: ['email-poller-status'] });
    },
    onError: (err: Error) => toast.error(`Trigger failed: ${err.message}`),
  });

  const providerColumns: ColumnDef<ProviderStatus>[] = [
    { key: 'name', label:'Provider', render: (_v, row) => <span className="font-medium">{row.name}</span> },
    { key: 'mailbox', label:'Mailbox' },
    { key: 'folder', label:'Folder' },
    { key: 'intervalMs', label:'Interval', render: (_v, row) => `${Math.round(row.intervalMs / 1000)}s` },
    { key: 'lastPollStatus', label:'Last Poll', render: (_v, row) => (
      <StatusBadge status={row.lastPollStatus === 'success' ? 'success' : row.lastPollStatus === 'error' ? 'error' : 'neutral'}>
        {row.lastPollStatus || 'Never'}
      </StatusBadge>
    )},
    { key: 'rateLimit', label:'Rate', render: (_v, row) => `${row.rateLimit?.current || 0}/min` },
    { key: 'stats', label:'Processed', render: (_v, row) => row.stats?.TotalProcessed?.toLocaleString() || '0' },
    { key: 'actions', label:'', render: (_v, row) => (
      <Button size="sm" variant="ghost" onClick={() => triggerMutation.mutate(row.providerId)}>
        <RefreshCw className="w-3 h-3" />
      </Button>
    )},
  ];

  const breakerColumns: ColumnDef<CircuitBreakerStatus>[] = [
    { key: 'workflowCode', label:'Workflow', render: (_v, row) => <span className="font-mono text-sm">{row.workflowCode}</span> },
    { key: 'state', label:'State', render: (_v, row) => (
      <StatusBadge status={row.state === 'CLOSED' ? 'success' : row.state === 'OPEN' ? 'error' : 'warning'}>
        {row.state}
      </StatusBadge>
    )},
    { key: 'successes', label:'Successes' },
    { key: 'failures', label:'Failures' },
    { key: 'rejects', label:'Rejected' },
    { key: 'timeouts', label:'Timeouts' },
  ];

  return (
    <div className="space-y-6">
      <TableCard title="Providers" count={providers.length}>
        <DataTable<ProviderStatus>
          id="pollit-providers"
          columns={providerColumns}
          data={providers}
          rowKey="providerId"
          emptyMessage="No providers configured"
          embedded
          showColumnPicker={false}
        />
      </TableCard>

      {clamav && (
        <Card>
          <div className="flex items-center gap-3 mb-3">
            <Shield className="w-5 h-5" />
            <h3 className="text-sm font-medium">ClamAV Antivirus</h3>
            <StatusBadge status={clamav.status === 'connected' ? 'success' : clamav.enabled ? 'warning' : 'neutral'}>
              {clamav.status === 'connected' ? 'Connected' : clamav.enabled ? 'Unavailable' : 'Disabled'}
            </StatusBadge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted">Enabled</span>
              <div className="font-medium">{clamav.enabled ? 'Yes' : 'No'}</div>
            </div>
            <div>
              <span className="text-muted">Host</span>
              <div className="font-medium font-mono">{clamav.host || '-'}</div>
            </div>
            <div>
              <span className="text-muted">Port</span>
              <div className="font-medium font-mono">{clamav.port || '-'}</div>
            </div>
            <div>
              <span className="text-muted">Status</span>
              <div className="font-medium">{clamav.status === 'connected' ? 'Scanning active' : clamav.enabled ? 'Connection failed — scans skipped' : 'Virus scanning disabled'}</div>
            </div>
          </div>
        </Card>
      )}

      {circuitBreakers.length > 0 && (
        <TableCard title="Circuit Breakers" count={circuitBreakers.length}>
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
    { key: 'Priority', label:'Priority', render: (_v, row) => <span className="font-mono">{row.Priority}</span> },
    { key: 'Name', label:'Name', render: (_v, row) => <span className="font-medium">{row.Name}</span> },
    { key: 'match', label:'Match', render: (_v, row) => {
      const parts = [];
      if (row.MatchRecipient) parts.push(`To: ${row.MatchRecipient}`);
      if (row.MatchRecipientPattern) parts.push(`To: ${row.MatchRecipientPattern}`);
      if (row.MatchSubjectPattern) parts.push(`Subj: ${row.MatchSubjectPattern}`);
      if (row.MatchSenderDomain) parts.push(`Domain: ${row.MatchSenderDomain}`);
      if (row.MatchSenderAddress) parts.push(`From: ${row.MatchSenderAddress}`);
      return <span className="text-sm text-muted">{parts.join(', ') || 'Catch-all'}</span>;
    }},
    { key: 'WorkflowCode', label:'Workflow', render: (_v, row) => (
      <span className="font-mono text-sm bg-surface-100 px-2 py-0.5 rounded">{row.WorkflowCode}</span>
    )},
    { key: 'IsActive', label:'Active', render: (_v, row) => (
      <StatusBadge status={row.IsActive ? 'success' : 'neutral'}>{row.IsActive ? 'Yes' : 'No'}</StatusBadge>
    )},
    { key: 'actions', label:'', render: (_v, row) => (
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => handleEdit(row)}><Edit3 className="w-3 h-3" /></Button>
        <Button size="sm" variant="ghost" onClick={() => {
          if (confirm(`Delete rule "${row.Name}"?`)) deleteMutation.mutate(row.RuleId);
        }}><Trash2 className="w-3 h-3 text-red-400" /></Button>
      </div>
    )},
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

      <Modal isOpen={isOpen} onClose={close} title={editingRule ? 'Edit Routing Rule' : 'New Routing Rule'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Name *</label>
              <input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., PO Emails" />
            </div>
            <div>
              <label className="label">Priority</label>
              <input className="input-field" type="number" value={form.priority} onChange={e => setForm({ ...form, priority: parseInt(e.target.value) || 100 })} />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input-field" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="border-t border-surface-200 pt-4">
            <h4 className="text-sm font-medium mb-3">Match Conditions <span className="text-muted">(all non-empty conditions must match)</span></h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Recipient (exact)</label>
                <input className="input-field" value={form.matchRecipient} onChange={e => setForm({ ...form, matchRecipient: e.target.value })} placeholder="po@company.com" />
              </div>
              <div>
                <label className="label">Recipient (pattern)</label>
                <input className="input-field" value={form.matchRecipientPattern} onChange={e => setForm({ ...form, matchRecipientPattern: e.target.value })} placeholder="*-po@company.com" />
              </div>
              <div>
                <label className="label">Subject (contains/*glob*)</label>
                <input className="input-field" value={form.matchSubjectPattern} onChange={e => setForm({ ...form, matchSubjectPattern: e.target.value })} placeholder="*quote*" />
              </div>
              <div>
                <label className="label">Sender Domain</label>
                <input className="input-field" value={form.matchSenderDomain} onChange={e => setForm({ ...form, matchSenderDomain: e.target.value })} placeholder="supplier.com" />
              </div>
              <div>
                <label className="label">Sender Address (exact)</label>
                <input className="input-field" value={form.matchSenderAddress} onChange={e => setForm({ ...form, matchSenderAddress: e.target.value })} placeholder="orders@supplier.com" />
              </div>
            </div>
          </div>
          <div className="border-t border-surface-200 pt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="label">Workflow *</label>
              <select className="input-field" value={form.workflowCode} onChange={e => setForm({ ...form, workflowCode: e.target.value })}>
                {workflows.map(w => <option key={w} value={w}>{w}</option>)}
                {workflows.length === 0 && <option value="DOCUMENT_CAPTURE">DOCUMENT_CAPTURE</option>}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
                <span className="text-sm">Active</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.workflowCode}>
              {editingRule ? 'Update' : 'Create'}
            </Button>
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
