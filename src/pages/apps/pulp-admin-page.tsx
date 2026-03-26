import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileText, Database, Archive, Shield, CheckCircle, Clock, Plus, Edit3, Trash2, RefreshCw, AlertTriangle, ExternalLink, Star, Wifi, WifiOff } from 'lucide-react';
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
import type { StagedDocument, RetentionPolicy, ExpiringDocument, RetentionLogEntry, ApprovalWorkflow, Provider, ArchivedDocument } from '@/types';
import {
  getHealth,
  getDocumentStats,
  getStagedDocuments,
  approveStagedDocument,
  rejectStagedDocument,
  getRetentionPolicies,
  createRetentionPolicy,
  updateRetentionPolicy,
  deleteRetentionPolicy,
  getExpiringDocuments,
  extendDocumentRetention,
  exemptDocumentRetention,
  getRetentionLog,
  triggerRetentionEnforcement,
  getApprovalWorkflows,
  createApprovalWorkflow,
  deleteApprovalWorkflow,
  getProviders,
  getProvidersByApp,
  testProvider,
  getArchivedDocuments,
} from '@/services/admin-service';

// ===== Constants =====

const tabs: TabItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <FileText className="w-4 h-4" /> },
  { id: 'staged', label: 'Staged Queue', icon: <Clock className="w-4 h-4" /> },
  { id: 'archive', label: 'Archive', icon: <Archive className="w-4 h-4" /> },
  { id: 'workflows', label: 'Approvals', icon: <CheckCircle className="w-4 h-4" /> },
  { id: 'providers', label: 'Provider', icon: <Database className="w-4 h-4" /> },
];

const STAGED_STATUSES_ACTIONABLE = ['CAPTURED', 'CLASSIFYING', 'STAGED', 'REVIEWING'];

// ===== Form types =====

interface PolicyForm {
  policyName: string;
  documentType: string;
  retentionPeriodDays: number;
  action: string;
  notifyRoles: string;
  notifyDaysBefore: number;
}

const INITIAL_POLICY_FORM: PolicyForm = {
  policyName: '', documentType: '', retentionPeriodDays: 0, action: 'ARCHIVE', notifyRoles: '', notifyDaysBefore: 30,
};

const DOCUMENT_TYPE_OPTIONS = [
  { value: '', label: 'All Types (default)' },
  { value: 'DRAWING', label: 'Drawing' },
  { value: 'COA', label: 'COA' },
  { value: 'INVOICE', label: 'Invoice' },
  { value: 'CUSTOMER_PO', label: 'Customer PO' },
  { value: 'PURCHASE_ORDER', label: 'Purchase Order' },
  { value: 'PACKING_LIST', label: 'Packing List' },
  { value: 'BOL', label: 'BOL' },
  { value: 'MSDS', label: 'MSDS' },
  { value: 'SPEC_SHEET', label: 'Spec Sheet' },
  { value: 'QUALITY_REPORT', label: 'Quality Report' },
  { value: 'PHOTO', label: 'Photo' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'OTHER', label: 'Other' },
];

interface WorkflowForm {
  workflowName: string;
  documentType: string;
  requiredApprovals: number;
  approvalRoles: string;
  sequentialApproval: boolean;
  autoPublishOnApproval: boolean;
}

const INITIAL_WF_FORM: WorkflowForm = {
  workflowName: '', documentType: '', requiredApprovals: 1, approvalRoles: '',
  sequentialApproval: false, autoPublishOnApproval: true,
};

// ===== Component =====

export default function PulpAdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Archive sub-tab
  const [archiveSubTab, setArchiveSubTab] = useState('documents');

  // Policy modal
  const policyModal = useModal();
  const [policyForm, setPolicyForm] = useState<PolicyForm>(INITIAL_POLICY_FORM);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);

  // Storage providers test state
  const [testingId, setTestingId] = useState<string | null>(null);

  // Workflow modal
  const workflowModal = useModal();
  const [wfForm, setWfForm] = useState<WorkflowForm>(INITIAL_WF_FORM);

  // ===== Queries =====

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin', 'pulp', 'stats'],
    queryFn: getDocumentStats,
  });

  const { data: healthData } = useQuery({
    queryKey: ['bridge', 'health'],
    queryFn: getHealth,
    refetchInterval: 30000,
  });
  const isServiceConnected = !!healthData && healthData?.apps?.pulp?.enabled !== false;

  const { data: providersData, isLoading: providersLoading } = useQuery({
    queryKey: ['admin', 'providers', { app: 'PULP' }],
    queryFn: () => getProvidersByApp('PULP'),
    enabled: activeTab === 'providers',
  });

  const { data: stagedDocs, isLoading: stagedLoading } = useQuery({
    queryKey: ['admin', 'pulp', 'staged'],
    queryFn: () => getStagedDocuments(50),
    enabled: activeTab === 'staged',
  });

  const { data: policies, isLoading: policiesLoading } = useQuery({
    queryKey: ['admin', 'pulp', 'retention-policies'],
    queryFn: getRetentionPolicies,
    enabled: activeTab === 'archive' && archiveSubTab === 'policies',
  });

  const { data: expiringDocs, isLoading: expiringLoading } = useQuery({
    queryKey: ['admin', 'pulp', 'expiring'],
    queryFn: () => getExpiringDocuments(30),
    enabled: activeTab === 'archive' && archiveSubTab === 'expiring',
  });

  const { data: retentionLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['admin', 'pulp', 'retention-log'],
    queryFn: () => getRetentionLog(50),
    enabled: activeTab === 'archive' && archiveSubTab === 'log',
  });

  const { data: approvalWorkflows, isLoading: workflowsLoading } = useQuery({
    queryKey: ['admin', 'pulp', 'approval-workflows'],
    queryFn: getApprovalWorkflows,
    enabled: activeTab === 'workflows',
  });

  const { data: archivedDocs, isLoading: archivedLoading } = useQuery({
    queryKey: ['admin', 'pulp', 'archived-documents'],
    queryFn: () => getArchivedDocuments({ limit: 50 }),
    enabled: activeTab === 'archive' && archiveSubTab === 'documents',
  });

  const providersList: Provider[] = providersData?.data || [];
  const stagedList: StagedDocument[] = Array.isArray(stagedDocs) ? stagedDocs : [];
  const policiesList: RetentionPolicy[] = Array.isArray(policies) ? policies : [];
  const expiringList: ExpiringDocument[] = Array.isArray(expiringDocs) ? expiringDocs : [];
  const logsList: RetentionLogEntry[] = Array.isArray(retentionLogs) ? retentionLogs : [];
  const workflowsList: ApprovalWorkflow[] = Array.isArray(approvalWorkflows) ? approvalWorkflows : [];
  const archivedList: ArchivedDocument[] = Array.isArray(archivedDocs) ? archivedDocs : (archivedDocs as { data?: ArchivedDocument[] })?.data || [];

  const invalidatePulp = () => queryClient.invalidateQueries({ queryKey: ['admin', 'pulp'] });

  // ===== Mutations =====

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveStagedDocument(id),
    onSuccess: () => { invalidatePulp(); toast.success('Document approved'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => rejectStagedDocument(id, notes),
    onSuccess: () => { invalidatePulp(); toast.success('Document rejected'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const createPolicyMutation = useMutation({
    mutationFn: (data: { policyName: string; documentType?: string | null; retentionPeriodDays: number; action: string; notifyRoles?: string | null; notifyDaysBefore: number }) =>
      createRetentionPolicy(data),
    onSuccess: () => { invalidatePulp(); policyModal.close(); setEditingPolicyId(null); toast.success('Policy created'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const updatePolicyMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ policyName: string; documentType: string | null; retentionPeriodDays: number; action: string; notifyRoles: string | null; notifyDaysBefore: number }> }) =>
      updateRetentionPolicy(id, data),
    onSuccess: () => { invalidatePulp(); policyModal.close(); setEditingPolicyId(null); toast.success('Policy updated'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deletePolicyMutation = useMutation({
    mutationFn: (id: string) => deleteRetentionPolicy(id),
    onSuccess: () => { invalidatePulp(); toast.success('Policy deleted'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const enforceMutation = useMutation({
    mutationFn: () => triggerRetentionEnforcement(),
    onSuccess: (data: any) => {
      const msg = `Enforcement complete: ${data.archived || 0} archived, ${data.deleted || 0} deleted, ${data.notified || 0} notified`;
      toast.success(msg);
      invalidatePulp();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const extendMutation = useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) => extendDocumentRetention(id, date),
    onSuccess: () => { invalidatePulp(); toast.success('Retention extended'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const exemptMutation = useMutation({
    mutationFn: (id: string) => exemptDocumentRetention(id),
    onSuccess: () => { invalidatePulp(); toast.success('Document exempted'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const createWfMutation = useMutation({
    mutationFn: (data: { workflowName: string; documentType?: string | null; requiredApprovals: number; approvalRoles: string[]; sequentialApproval: boolean; autoPublishOnApproval: boolean }) =>
      createApprovalWorkflow(data),
    onSuccess: () => { invalidatePulp(); workflowModal.close(); toast.success('Workflow created'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteWfMutation = useMutation({
    mutationFn: (id: string) => deleteApprovalWorkflow(id),
    onSuccess: () => { invalidatePulp(); toast.success('Workflow deleted'); },
    onError: (err: Error) => toast.error(err.message),
  });

  // ===== Handlers =====

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

  function handleApprove(doc: StagedDocument) {
    approveMutation.mutate(doc.StagedDocumentId);
  }

  function handleReject(doc: StagedDocument) {
    const notes = window.prompt('Rejection reason (optional):');
    if (notes === null) return;
    rejectMutation.mutate({ id: doc.StagedDocumentId, notes });
  }

  function openCreatePolicy() {
    setEditingPolicyId(null);
    setPolicyForm(INITIAL_POLICY_FORM);
    policyModal.open();
  }

  function openEditPolicy(policy: RetentionPolicy) {
    setEditingPolicyId(policy.PolicyId);
    setPolicyForm({
      policyName: policy.PolicyName,
      documentType: policy.DocumentType || '',
      retentionPeriodDays: policy.RetentionPeriodDays,
      action: policy.Action,
      notifyRoles: policy.NotifyRoles || '',
      notifyDaysBefore: policy.NotifyDaysBefore ?? 30,
    });
    policyModal.open();
  }

  function handleSavePolicy() {
    if (!policyForm.policyName.trim()) { toast.error('Policy name is required'); return; }
    const payload = {
      policyName: policyForm.policyName,
      documentType: policyForm.documentType || null,
      retentionPeriodDays: policyForm.retentionPeriodDays,
      action: policyForm.action,
      notifyRoles: policyForm.notifyRoles.trim() || null,
      notifyDaysBefore: policyForm.notifyDaysBefore,
    };
    if (editingPolicyId) {
      updatePolicyMutation.mutate({ id: editingPolicyId, data: payload });
    } else {
      createPolicyMutation.mutate(payload);
    }
  }

  function handleExtend(doc: ExpiringDocument) {
    const dateStr = window.prompt('Enter new expiry date (YYYY-MM-DD):');
    if (!dateStr) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) { toast.error('Invalid date format. Use YYYY-MM-DD.'); return; }
    extendMutation.mutate({ id: doc.DocumentId, date: dateStr });
  }

  function handleExempt(doc: ExpiringDocument) {
    if (!window.confirm('Exempt this document from retention? It will be set to PERMANENT.')) return;
    exemptMutation.mutate(doc.DocumentId);
  }

  function handleEnforce() {
    if (!window.confirm('Run retention enforcement now? This will archive/delete expired documents according to their policies.')) return;
    enforceMutation.mutate();
  }

  function openCreateWorkflow() {
    setWfForm(INITIAL_WF_FORM);
    workflowModal.open();
  }

  function handleSaveWorkflow() {
    if (!wfForm.workflowName.trim()) { toast.error('Workflow name is required'); return; }
    const roles = wfForm.approvalRoles.split(',').map((r) => r.trim()).filter(Boolean);
    if (roles.length === 0) { toast.error('At least one approval role is required'); return; }
    createWfMutation.mutate({
      workflowName: wfForm.workflowName,
      documentType: wfForm.documentType || null,
      requiredApprovals: wfForm.requiredApprovals,
      approvalRoles: roles,
      sequentialApproval: wfForm.sequentialApproval,
      autoPublishOnApproval: wfForm.autoPublishOnApproval,
    });
  }

  // ===== Column definitions =====

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
      key: 'Category', label: 'Category', width: 100, sortable: true,
      render: (val) => {
        const map: Record<string, 'success' | 'info' | 'neutral'> = { AI: 'success', STORAGE: 'info' };
        return <StatusBadge status={map[val as string] || 'neutral'} label={(val as string) || '-'} size="sm" />;
      },
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

  const stagedColumns: ColumnDef<StagedDocument>[] = [
    { key: 'OriginalFileName', label: 'File Name', sortable: true, filterable: true, render: (val) => <span className="text-semantic-text-default">{val}</span> },
    {
      key: 'Status', label: 'Status', width: 110, sortable: true,
      render: (val) => {
        const map: Record<string, 'info' | 'warning' | 'success' | 'danger' | 'neutral'> = {
          CAPTURED: 'info', CLASSIFYING: 'warning', STAGED: 'info', REVIEWING: 'warning',
          APPROVED: 'success', POSTED: 'success', REJECTED: 'danger', FAILED: 'danger',
        };
        return <StatusBadge status={map[val] || 'neutral'} label={val} size="sm" />;
      },
    },
    { key: 'ClassifiedType', label: 'Type', width: 120, render: (val) => <span className="text-semantic-text-faint">{val || '-'}</span> },
    { key: 'CaptureSource', label: 'Source', width: 100, render: (val) => <span className="text-semantic-text-faint">{val}</span> },
    { key: 'CreatedAt', label: 'Created', width: 160, render: (val) => <span className="text-xs text-semantic-text-faint">{val ? new Date(val).toLocaleString() : '-'}</span> },
    {
      key: 'StagedDocumentId', label: 'Actions', width: 140, sortable: false,
      render: (_val, row) => {
        const canAct = STAGED_STATUSES_ACTIONABLE.includes(row.Status);
        if (!canAct) return <span className="text-semantic-text-faint">-</span>;
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" onClick={() => handleApprove(row)} loading={approveMutation.isPending}>Approve</Button>
            <Button size="sm" variant="danger" onClick={() => handleReject(row)} loading={rejectMutation.isPending}>Reject</Button>
          </div>
        );
      },
    },
  ];

  const archivedColumns: ColumnDef<ArchivedDocument>[] = [
    { key: 'DocumentName', label: 'Document', sortable: true, filterable: true, render: (val) => <span className="font-medium text-semantic-text-default">{val}</span> },
    { key: 'DocumentType', label: 'Type', width: 120, filterable: true, render: (val) => <span className="text-semantic-text-faint">{val}</span> },
    { key: 'RetentionPolicy', label: 'Policy', width: 160, render: (val) => <span className="text-semantic-text-faint">{val || '-'}</span> },
    { key: 'UpdatedAt', label: 'Archived', width: 120, sortable: true, render: (val) => <span className="text-semantic-text-faint">{val ? new Date(val).toLocaleDateString() : '-'}</span> },
    { key: 'CreatedBy', label: 'Created By', width: 120, render: (val) => <span className="text-semantic-text-faint">{val}</span> },
    { key: 'FileSizeBytes', label: 'Size', width: 100, render: (val) => <span className="text-semantic-text-faint tabular-nums">{val ? formatStorageSize(val / (1024 * 1024)) : '-'}</span> },
    { key: 'HasArchiveFile', label: 'File', width: 60, render: (val) => <StatusBadge status={val ? 'success' : 'neutral'} label={val ? 'Yes' : 'No'} size="sm" /> },
  ];

  const policyColumns: ColumnDef<RetentionPolicy>[] = [
    { key: 'PolicyName', label: 'Name', sortable: true, filterable: true, render: (val) => <span className="font-medium text-semantic-text-default">{val}</span> },
    { key: 'DocumentType', label: 'Doc Type', width: 120, render: (val) => val ? <span className="text-semantic-text-secondary">{val}</span> : <span className="text-semantic-text-faint">Default</span> },
    { key: 'RetentionPeriodDays', label: 'Retention', width: 110, render: (val) => <span className="text-semantic-text-faint">{val === 0 ? 'Permanent' : formatRetentionDays(val)}</span> },
    {
      key: 'Action', label: 'Action', width: 100,
      render: (val) => {
        const map: Record<string, 'info' | 'danger' | 'warning'> = { ARCHIVE: 'info', DELETE: 'danger', NOTIFY: 'warning' };
        return <StatusBadge status={map[val] || 'neutral'} label={val} size="sm" />;
      },
    },
    { key: 'NotifyDaysBefore', label: 'Notify Days', width: 100, render: (val) => <span className="text-semantic-text-faint">{val || '-'}</span> },
    { key: 'IsActive', label: 'Active', width: 80, render: (val) => <StatusBadge status={val ? 'success' : 'danger'} label={val ? 'Yes' : 'No'} size="sm" /> },
    {
      key: 'PolicyId', label: 'Actions', width: 100, sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openEditPolicy(row)} className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover" title="Edit"><Edit3 className="w-4 h-4" /></button>
          <button type="button" onClick={() => { if (window.confirm('Delete this policy?')) deletePolicyMutation.mutate(row.PolicyId); }} className="p-1.5 text-semantic-text-faint hover:text-danger rounded hover:bg-interactive-hover" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  const expiringColumns: ColumnDef<ExpiringDocument>[] = [
    { key: 'DocumentName', label: 'Document', sortable: true, render: (val) => <span className="text-semantic-text-default">{val}</span> },
    { key: 'DocumentType', label: 'Type', width: 120, render: (val) => <span className="text-semantic-text-faint">{val}</span> },
    { key: 'RetentionPolicy', label: 'Policy', width: 160, render: (val) => <span className="text-semantic-text-faint">{val}</span> },
    { key: 'RetentionExpiryDate', label: 'Expires', width: 120, render: (val) => <span className="text-warning">{val ? new Date(val).toLocaleDateString() : '-'}</span> },
    {
      key: 'DocumentId', label: 'Actions', width: 140, sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="secondary" onClick={() => handleExtend(row)}>Extend</Button>
          <Button size="sm" variant="secondary" onClick={() => handleExempt(row)}>Exempt</Button>
        </div>
      ),
    },
  ];

  const logColumns: ColumnDef<RetentionLogEntry>[] = [
    { key: 'PerformedAt', label: 'Date', width: 160, sortable: true, render: (val) => <span className="text-xs text-semantic-text-faint">{val ? new Date(val).toLocaleString() : '-'}</span> },
    { key: 'DocumentName', label: 'Document', sortable: true, render: (val, row) => <span className="text-semantic-text-default">{val || row.DocumentId}</span> },
    {
      key: 'Action', label: 'Action', width: 100,
      render: (val) => {
        const map: Record<string, 'info' | 'danger' | 'warning' | 'success'> = { ARCHIVED: 'info', DELETED: 'danger', NOTIFIED: 'warning', EXTENDED: 'success', EXEMPTED: 'success' };
        return <StatusBadge status={map[val] || 'neutral'} label={val} size="sm" />;
      },
    },
    { key: 'Reason', label: 'Reason', render: (val) => <span className="text-semantic-text-faint">{val || '-'}</span> },
    { key: 'PerformedBy', label: 'By', width: 120, render: (val) => <span className="text-semantic-text-faint">{val}</span> },
  ];

  const workflowColumns: ColumnDef<ApprovalWorkflow>[] = [
    { key: 'WorkflowName', label: 'Name', sortable: true, filterable: true, render: (val) => <span className="font-medium text-semantic-text-default">{val}</span> },
    { key: 'DocumentType', label: 'Doc Type', width: 120, render: (val) => val ? <span className="text-semantic-text-secondary">{val}</span> : <span className="text-semantic-text-faint">Any</span> },
    { key: 'RequiredApprovals', label: 'Required', width: 80 },
    {
      key: 'ApprovalRoles', label: 'Roles', render: (val) => {
        const roles = Array.isArray(val) ? val : [];
        return <div className="flex flex-wrap gap-1">{roles.map((r: string) => <span key={r} className="px-2 py-0.5 bg-info/10 text-info text-xs rounded-full">{r}</span>)}</div>;
      },
    },
    { key: 'SequentialApproval', label: 'Order', width: 100, render: (val) => val ? <span className="text-warning">Sequential</span> : <span className="text-primary">Parallel</span> },
    { key: 'AutoPublishOnApproval', label: 'Auto-Publish', width: 100, render: (val) => val ? <span className="text-success">Yes</span> : <span className="text-semantic-text-faint">No</span> },
    {
      key: 'WorkflowId', label: 'Actions', width: 80, sortable: false,
      render: (_val, row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => { if (window.confirm('Delete this workflow?')) deleteWfMutation.mutate(row.WorkflowId); }} className="p-1.5 text-semantic-text-faint hover:text-danger rounded hover:bg-interactive-hover" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  // ===== Derived values =====

  const stagedCount = (stats?.stagedQueue || [])
    .filter((s: { Status: string }) => STAGED_STATUSES_ACTIONABLE.includes(s.Status))
    .reduce((sum: number, s: { Count: number }) => sum + s.Count, 0);

  // ===== Render =====

  return (
    <div className="space-y-6">
      <PageHeader
        title="PulpIT"
        description="Document management configuration"
      />

      {/* Status Bar */}
      <PageStatusBar items={[
        { type: 'badge', label: 'Service', status: isServiceConnected ? 'success' : 'danger', badgeLabel: isServiceConnected ? 'Connected' : 'Offline' },
        { type: 'text', label: 'Total Documents', value: stats?.totalDocuments || 0 },
        { type: 'text', label: 'Storage Used', value: formatStorageSize(stats?.storageMB || 0) },
        { type: 'text', label: 'Staged Queue', value: stagedCount, colorClass: stagedCount > 0 ? 'text-warning' : 'text-semantic-text-faint' },
      ]} />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab: Dashboard */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {statsLoading ? <LoadingSpinner size="lg" /> : stats ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard label="Total Documents" value={String(stats.totalDocuments || 0)} color="text-primary" />
                <StatCard label="Storage Used" value={formatStorageSize(stats.storageMB || 0)} color="text-info" />
                <StatCard
                  label="Staged Queue"
                  value={String(
                    (stats.stagedQueue || [])
                      .filter((s: { Status: string }) => STAGED_STATUSES_ACTIONABLE.includes(s.Status))
                      .reduce((sum: number, s: { Count: number }) => sum + s.Count, 0)
                  )}
                  color="text-warning"
                />
              </div>

              {/* Documents by type */}
              {stats.byType && stats.byType.length > 0 && (
                <Card title="Documents by Type">
                  <div className="space-y-2">
                    {stats.byType.map((t: { DocumentType: string; Count: number }) => (
                      <div key={t.DocumentType} className="flex items-center justify-between px-3 py-2 bg-interactive-hover rounded-lg">
                        <span className="text-sm text-semantic-text-default">{t.DocumentType}</span>
                        <span className="text-sm text-semantic-text-faint">{t.Count}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-sm text-semantic-text-faint">Unable to load document statistics</div>
          )}
        </div>
      )}

      {/* Tab: Providers */}
      {activeTab === 'providers' && (
        <TableCard
          title="Providers"
          icon={<Database className="w-4 h-4" />}
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
          {providersLoading ? <LoadingSpinner size="lg" /> : (
            <DataTable<Provider>
              id="admin-pulp-providers"
              columns={providerColumns}
              data={providersList}
              rowKey="ProviderId"
              emptyMessage="No providers assigned to PulpIT"
              emptyIcon={Database}
              embedded
              showColumnPicker={false}
            />
          )}
        </TableCard>
      )}

      {/* Tab: Staged Queue */}
      {activeTab === 'staged' && (
        <TableCard
          title="Staged Documents"
          icon={<Clock className="w-4 h-4" />}
          count={stagedList.length}
        >
          {stagedLoading ? <LoadingSpinner size="lg" /> : (
            <DataTable<StagedDocument>
              id="admin-pulp-staged"
              columns={stagedColumns}
              data={stagedList}
              rowKey="StagedDocumentId"
              emptyMessage="Staging queue is empty"
              emptyIcon={Clock}
              showFilters
              embedded
              showColumnPicker={false}
            />
          )}
        </TableCard>
      )}

      {/* Tab: Archive */}
      {activeTab === 'archive' && (
        <div className="space-y-4">
          {/* Sub-tabs */}
          <div className="flex items-center gap-2">
            {['documents', 'policies', 'expiring', 'log'].map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => setArchiveSubTab(sub)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  archiveSubTab === sub
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-semantic-text-faint hover:text-semantic-text-secondary hover:border-border'
                }`}
              >
                {sub === 'documents' ? 'Documents' : sub === 'policies' ? 'Policies' : sub === 'expiring' ? 'Expiring Soon' : 'Enforcement Log'}
              </button>
            ))}
            <div className="flex-1" />
            <Button
              variant="secondary"
              size="sm"
              icon={<AlertTriangle className="w-3.5 h-3.5" />}
              onClick={handleEnforce}
              loading={enforceMutation.isPending}
            >
              Run Enforcement
            </Button>
          </div>

          {archiveSubTab === 'documents' && (
            <TableCard
              title="Archived Documents"
              icon={<Archive className="w-4 h-4" />}
              count={archivedList.length}
            >
              {archivedLoading ? <LoadingSpinner size="lg" /> : (
                <DataTable<ArchivedDocument>
                  id="admin-pulp-archived"
                  columns={archivedColumns}
                  data={archivedList}
                  rowKey="DocumentId"
                  emptyMessage="No archived documents"
                  emptyIcon={Archive}
                  showFilters
                  embedded
                  showColumnPicker={false}
                />
              )}
            </TableCard>
          )}

          {archiveSubTab === 'policies' && (
            <TableCard
              title="Retention Policies"
              icon={<Shield className="w-4 h-4" />}
              count={policiesList.length}
              headerActions={
                <Button icon={<Plus className="w-4 h-4" />} onClick={openCreatePolicy}>New Policy</Button>
              }
            >
              {policiesLoading ? <LoadingSpinner size="lg" /> : (
                <DataTable<RetentionPolicy>
                  id="admin-pulp-policies"
                  columns={policyColumns}
                  data={policiesList}
                  rowKey="PolicyId"
                  emptyMessage="No retention policies defined"
                  emptyIcon={Shield}
                  showFilters
                  embedded
                  showColumnPicker={false}
                />
              )}
            </TableCard>
          )}

          {archiveSubTab === 'expiring' && (
            <TableCard
              title="Expiring Documents"
              icon={<Clock className="w-4 h-4" />}
              count={expiringList.length}
            >
              {expiringLoading ? <LoadingSpinner size="lg" /> : (
                <DataTable<ExpiringDocument>
                  id="admin-pulp-expiring"
                  columns={expiringColumns}
                  data={expiringList}
                  rowKey="DocumentId"
                  emptyMessage="No documents expiring in the next 30 days"
                  emptyIcon={Clock}
                  embedded
                  showColumnPicker={false}
                />
              )}
            </TableCard>
          )}

          {archiveSubTab === 'log' && (
            <TableCard
              title="Enforcement Log"
              icon={<FileText className="w-4 h-4" />}
              count={logsList.length}
            >
              {logsLoading ? <LoadingSpinner size="lg" /> : (
                <DataTable<RetentionLogEntry>
                  id="admin-pulp-retention-log"
                  columns={logColumns}
                  data={logsList}
                  rowKey="DocumentId"
                  emptyMessage="No retention actions recorded"
                  emptyIcon={FileText}
                  embedded
                  showColumnPicker={false}
                />
              )}
            </TableCard>
          )}
        </div>
      )}

      {/* Tab: Approval Workflows */}
      {activeTab === 'workflows' && (
        <TableCard
          title="Approval Workflows"
          icon={<CheckCircle className="w-4 h-4" />}
          count={workflowsList.length}
          headerActions={
            <Button icon={<Plus className="w-4 h-4" />} onClick={openCreateWorkflow}>New Workflow</Button>
          }
        >
          {workflowsLoading ? <LoadingSpinner size="lg" /> : (
            <DataTable<ApprovalWorkflow>
              id="admin-pulp-workflows"
              columns={workflowColumns}
              data={workflowsList}
              rowKey="WorkflowId"
              emptyMessage="No approval workflows defined"
              emptyIcon={CheckCircle}
              showFilters
              embedded
              showColumnPicker={false}
            />
          )}
        </TableCard>
      )}

      {/* Create / Edit Policy Modal */}
      <Modal
        isOpen={policyModal.isOpen}
        onClose={() => { policyModal.close(); setEditingPolicyId(null); }}
        title={editingPolicyId ? 'Edit Retention Policy' : 'New Retention Policy'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => { policyModal.close(); setEditingPolicyId(null); }}>Cancel</Button>
            <Button onClick={handleSavePolicy} loading={editingPolicyId ? updatePolicyMutation.isPending : createPolicyMutation.isPending}>
              {editingPolicyId ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Policy Name" required>
              <input type="text" value={policyForm.policyName} onChange={(e) => setPolicyForm({ ...policyForm, policyName: e.target.value })} className="form-input" placeholder="e.g., Financial - 7 Year" />
            </FormField>
            <FormField label="Document Type">
              <select value={policyForm.documentType} onChange={(e) => setPolicyForm({ ...policyForm, documentType: e.target.value })} className="form-input" title="Document type">
                {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Retention (days)">
              <input type="number" min="0" value={policyForm.retentionPeriodDays} onChange={(e) => setPolicyForm({ ...policyForm, retentionPeriodDays: parseInt(e.target.value) || 0 })} className="form-input" placeholder="0 = permanent" />
              {policyForm.retentionPeriodDays > 0 && (
                <p className="text-xs text-semantic-text-faint mt-1">= {formatRetentionDays(policyForm.retentionPeriodDays)}</p>
              )}
            </FormField>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Action on Expiry">
              <select value={policyForm.action} onChange={(e) => setPolicyForm({ ...policyForm, action: e.target.value })} className="form-input" title="Action">
                <option value="ARCHIVE">ARCHIVE</option>
                <option value="DELETE">DELETE</option>
                <option value="NOTIFY">NOTIFY</option>
              </select>
            </FormField>
            <FormField label="Notify Roles">
              <input type="text" value={policyForm.notifyRoles} onChange={(e) => setPolicyForm({ ...policyForm, notifyRoles: e.target.value })} className="form-input" placeholder="e.g., ADMIN, QUALITY" />
            </FormField>
            <FormField label="Notify Days Before">
              <input type="number" min="0" value={policyForm.notifyDaysBefore} onChange={(e) => setPolicyForm({ ...policyForm, notifyDaysBefore: parseInt(e.target.value) || 30 })} className="form-input" />
            </FormField>
          </div>
        </div>
      </Modal>

      {/* Create Workflow Modal */}
      <Modal
        isOpen={workflowModal.isOpen}
        onClose={workflowModal.close}
        title="New Approval Workflow"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={workflowModal.close}>Cancel</Button>
            <Button onClick={handleSaveWorkflow} loading={createWfMutation.isPending}>Create</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Workflow Name" required>
              <input type="text" value={wfForm.workflowName} onChange={(e) => setWfForm({ ...wfForm, workflowName: e.target.value })} className="form-input" placeholder="e.g., Engineering Drawing Approval" />
            </FormField>
            <FormField label="Document Type">
              <input type="text" value={wfForm.documentType} onChange={(e) => setWfForm({ ...wfForm, documentType: e.target.value })} className="form-input" placeholder="e.g., DRAWING (blank = any)" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Approval Roles (comma separated)" required>
              <input type="text" value={wfForm.approvalRoles} onChange={(e) => setWfForm({ ...wfForm, approvalRoles: e.target.value })} className="form-input" placeholder="e.g., Engineering, Quality" />
            </FormField>
            <FormField label="Required Approvals">
              <input type="number" min="1" value={wfForm.requiredApprovals} onChange={(e) => setWfForm({ ...wfForm, requiredApprovals: parseInt(e.target.value) || 1 })} className="form-input" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Approval Order">
              <select
                value={wfForm.sequentialApproval ? '1' : '0'}
                onChange={(e) => setWfForm({ ...wfForm, sequentialApproval: e.target.value === '1' })}
                className="form-input"
                title="Approval order"
              >
                <option value="0">Parallel (any order)</option>
                <option value="1">Sequential (in order)</option>
              </select>
            </FormField>
            <FormField label="Auto-publish on approval">
              <select
                value={wfForm.autoPublishOnApproval ? '1' : '0'}
                onChange={(e) => setWfForm({ ...wfForm, autoPublishOnApproval: e.target.value === '1' })}
                className="form-input"
                title="Auto-publish"
              >
                <option value="1">Yes</option>
                <option value="0">No</option>
              </select>
            </FormField>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ===== Local helpers =====

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

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-surface-raised border border-border rounded-xl p-5">
      <div className="text-xs text-semantic-text-faint uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold mt-2 ${color}`}>{value}</div>
    </div>
  );
}

function formatStorageSize(mb: number): string {
  if (mb < 1) return `${Math.round(mb * 1024)} KB`;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatRetentionDays(days: number): string {
  if (days >= 365) {
    const years = Math.round(days / 365);
    return `${years} year${years !== 1 ? 's' : ''}`;
  }
  return `${days} days`;
}
