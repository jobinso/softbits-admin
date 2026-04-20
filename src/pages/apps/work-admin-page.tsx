import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Workflow, Play, Edit, Trash2, Plus, Key, RefreshCw, RotateCcw, Ban, Eye } from 'lucide-react';
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
} from '@/components/shared';
import type { TabItem, ColumnDef } from '@/components/shared';
import { useModal } from '@shared/hooks';
import type { WorkWorkflow, WorkExecution, WorkEventMapping, WorkApiKey } from '@/types';
import {
  getWorkHealth,
  getWorkWorkflows,
  createWorkWorkflow,
  updateWorkWorkflow,
  deleteWorkWorkflow,
  executeWorkWorkflow,
  getWorkExecutions,
  getWorkExecutionStats,
  getWorkExecution,
  retryWorkExecution,
  getWorkEventMappings,
  createWorkEventMapping,
  updateWorkEventMapping,
  deleteWorkEventMapping,
  getWorkApiKeys,
  createWorkApiKey,
  deleteWorkApiKey as deleteWorkApiKeyApi,
  rotateWorkApiKey,
  revokeWorkApiKey,
} from '@/services/admin-service';

// ===== Constants =====

const tabs: TabItem[] = [
  { id: 'status', label: 'Status', icon: <Workflow className="w-4 h-4" /> },
  { id: 'workflows', label: 'Workflows', icon: <Play className="w-4 h-4" /> },
  { id: 'mappings', label: 'Event Mappings', icon: <Workflow className="w-4 h-4" /> },
  { id: 'apikeys', label: 'API Keys', icon: <Key className="w-4 h-4" /> },
];

// ===== Form types =====

interface WorkflowForm {
  name: string;
  n8nWorkflowId: string;
  description: string;
  triggerType: string;
  timeoutMs: number;
  webhookUrl: string;
  isActive: boolean;
}

const INITIAL_WF_FORM: WorkflowForm = {
  name: '', n8nWorkflowId: '', description: '', triggerType: 'webhook',
  timeoutMs: 30000, webhookUrl: '', isActive: true,
};

interface MappingForm {
  eventType: string;
  workflowId: string;
  priority: number;
  conditions: string;
  transformTemplate: string;
  isActive: boolean;
}

const INITIAL_MAPPING_FORM: MappingForm = {
  eventType: '', workflowId: '', priority: 100, conditions: '',
  transformTemplate: '', isActive: true,
};

interface ApiKeyForm {
  name: string;
  description: string;
  permissions: string[];
  rateLimitPerMinute: number;
  expiresAt: string;
  allowedIPs: string;
}

const INITIAL_KEY_FORM: ApiKeyForm = {
  name: '', description: '', permissions: ['callback', 'status'],
  rateLimitPerMinute: 100, expiresAt: '', allowedIPs: '',
};

const ALL_PERMISSIONS = ['callback', 'status', 'execute', 'manage', 'read'];

// ===== Component =====

export default function WorkAdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('status');

  // Workflow modal
  const workflowModal = useModal<WorkWorkflow>();
  const deleteWfModal = useModal<WorkWorkflow>();
  const [wfForm, setWfForm] = useState<WorkflowForm>(INITIAL_WF_FORM);
  const [isEditingWf, setIsEditingWf] = useState(false);
  const [editingWfId, setEditingWfId] = useState<number | null>(null);

  // Execution detail modal
  const execDetailModal = useModal<WorkExecution>();
  const [execDetail, setExecDetail] = useState<WorkExecution | null>(null);

  // Mapping modal
  const mappingModal = useModal<WorkEventMapping>();
  const deleteMappingModal = useModal<WorkEventMapping>();
  const [mappingForm, setMappingForm] = useState<MappingForm>(INITIAL_MAPPING_FORM);
  const [isEditingMapping, setIsEditingMapping] = useState(false);
  const [editingMappingId, setEditingMappingId] = useState<number | null>(null);

  // API key modal
  const apiKeyModal = useModal();
  const [keyForm, setKeyForm] = useState<ApiKeyForm>(INITIAL_KEY_FORM);
  const [createdKey, setCreatedKey] = useState('');
  const createdKeyModal = useModal();

  // ===== Queries =====

  const { data: healthData } = useQuery({
    queryKey: ['admin', 'work', 'health'],
    queryFn: getWorkHealth,
    retry: false,
    refetchInterval: 15000,
  });

  const { data: workflowsData, isLoading: wfLoading } = useQuery({
    queryKey: ['admin', 'work', 'workflows'],
    queryFn: getWorkWorkflows,
    retry: false,
  });

  const { data: executionsData } = useQuery({
    queryKey: ['admin', 'work', 'executions'],
    queryFn: () => getWorkExecutions(),
    retry: false,
    enabled: activeTab === 'status',
  });

  const { data: execStats } = useQuery({
    queryKey: ['admin', 'work', 'execStats'],
    queryFn: getWorkExecutionStats,
    retry: false,
    enabled: activeTab === 'status',
  });

  const { data: mappingsData, isLoading: mappingsLoading } = useQuery({
    queryKey: ['admin', 'work', 'mappings'],
    queryFn: getWorkEventMappings,
    retry: false,
    enabled: activeTab === 'mappings',
  });

  const { data: apiKeysData, isLoading: keysLoading } = useQuery({
    queryKey: ['admin', 'work', 'apikeys'],
    queryFn: getWorkApiKeys,
    retry: false,
    enabled: activeTab === 'apikeys',
  });

  const workflows: WorkWorkflow[] = workflowsData?.workflows || [];
  const executions: WorkExecution[] = executionsData?.executions || [];
  const mappings: WorkEventMapping[] = mappingsData?.mappings || [];
  const apiKeys: WorkApiKey[] = apiKeysData?.apiKeys || [];

  const serviceConnected = !!healthData;
  const n8nConnected = healthData?.n8n?.status === 'connected';
  const activeWfCount = workflows.filter((w) => w.IsActive).length;

  // ===== Mutations =====

  const invalidateWork = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'work'] });
  };

  const saveWfMutation = useMutation({
    mutationFn: (data: { id?: number; payload: Record<string, unknown> }) =>
      data.id ? updateWorkWorkflow(data.id, data.payload) : createWorkWorkflow(data.payload),
    onSuccess: () => { invalidateWork(); workflowModal.close(); toast.success(isEditingWf ? 'Workflow updated' : 'Workflow created'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteWfMutation = useMutation({
    mutationFn: (id: number) => deleteWorkWorkflow(id),
    onSuccess: () => { invalidateWork(); deleteWfModal.close(); toast.success('Workflow deleted'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const execWfMutation = useMutation<{ executionId?: string | number }, Error, number>({
    mutationFn: (id: number) => executeWorkWorkflow(id) as Promise<{ executionId?: string | number }>,
    onSuccess: (data) => { toast.success(`Execution started (ID: ${data.executionId || 'N/A'})`); invalidateWork(); },
    onError: (err: Error) => toast.error(err.message),
  });

  const retryExecMutation = useMutation({
    mutationFn: (id: number) => retryWorkExecution(id),
    onSuccess: () => { toast.success('Retry started'); invalidateWork(); },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveMappingMutation = useMutation({
    mutationFn: (data: { id?: number; payload: Record<string, unknown> }) =>
      data.id ? updateWorkEventMapping(data.id, data.payload) : createWorkEventMapping(data.payload),
    onSuccess: () => { invalidateWork(); mappingModal.close(); toast.success(isEditingMapping ? 'Mapping updated' : 'Mapping created'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMappingMutation = useMutation({
    mutationFn: (id: number) => deleteWorkEventMapping(id),
    onSuccess: () => { invalidateWork(); deleteMappingModal.close(); toast.success('Mapping deleted'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const createKeyMutation = useMutation<{ apiKey?: { key?: string } }, Error, Record<string, unknown>>({
    mutationFn: (data: Record<string, unknown>) => createWorkApiKey(data) as Promise<{ apiKey?: { key?: string } }>,
    onSuccess: (data) => {
      apiKeyModal.close();
      setCreatedKey(data.apiKey?.key || '');
      createdKeyModal.open();
      invalidateWork();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rotateKeyMutation = useMutation<{ apiKey?: { key?: string } }, Error, number>({
    mutationFn: (id: number) => rotateWorkApiKey(id) as Promise<{ apiKey?: { key?: string } }>,
    onSuccess: (data) => {
      setCreatedKey(data.apiKey?.key || '');
      createdKeyModal.open();
      invalidateWork();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeKeyMutation = useMutation({
    mutationFn: (id: number) => revokeWorkApiKey(id),
    onSuccess: () => { invalidateWork(); toast.success('API key revoked'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteKeyMutation = useMutation({
    mutationFn: (id: number) => deleteWorkApiKeyApi(id),
    onSuccess: () => { invalidateWork(); toast.success('API key deleted'); },
    onError: (err: Error) => toast.error(err.message),
  });

  // ===== Handlers =====

  function openCreateWf() {
    setWfForm(INITIAL_WF_FORM);
    setIsEditingWf(false);
    setEditingWfId(null);
    workflowModal.open();
  }

  function openEditWf(wf: WorkWorkflow) {
    setWfForm({
      name: wf.Name, n8nWorkflowId: wf.N8NWorkflowId, description: wf.Description || '',
      triggerType: wf.TriggerType || 'webhook', timeoutMs: wf.TimeoutMs || 30000,
      webhookUrl: wf.WebhookUrl || '', isActive: wf.IsActive,
    });
    setIsEditingWf(true);
    setEditingWfId(wf.WorkflowId);
    workflowModal.open(wf);
  }

  function handleSaveWf() {
    if (!wfForm.name.trim()) { toast.error('Name is required'); return; }
    if (!wfForm.n8nWorkflowId.trim()) { toast.error('N8N Workflow ID is required'); return; }
    saveWfMutation.mutate({
      id: editingWfId || undefined,
      payload: {
        name: wfForm.name, n8nWorkflowId: wfForm.n8nWorkflowId, description: wfForm.description,
        triggerType: wfForm.triggerType, timeoutMs: wfForm.timeoutMs,
        webhookUrl: wfForm.webhookUrl, isActive: wfForm.isActive,
      },
    });
  }

  async function openExecDetail(exec: WorkExecution) {
    try {
      const data = await getWorkExecution(exec.ExecutionId);
      setExecDetail(data.execution);
      execDetailModal.open(exec);
    } catch {
      toast.error('Failed to load execution details');
    }
  }

  function openCreateMapping() {
    setMappingForm(INITIAL_MAPPING_FORM);
    setIsEditingMapping(false);
    setEditingMappingId(null);
    mappingModal.open();
  }

  function openEditMapping(m: WorkEventMapping) {
    setMappingForm({
      eventType: m.EventType, workflowId: String(m.WorkflowId), priority: m.Priority || 100,
      conditions: m.Conditions || '', transformTemplate: m.TransformTemplate || '', isActive: m.IsActive,
    });
    setIsEditingMapping(true);
    setEditingMappingId(m.MappingId);
    mappingModal.open(m);
  }

  function handleSaveMapping() {
    if (!mappingForm.eventType.trim()) { toast.error('Event type is required'); return; }
    if (!mappingForm.workflowId) { toast.error('Workflow is required'); return; }
    saveMappingMutation.mutate({
      id: editingMappingId || undefined,
      payload: {
        eventType: mappingForm.eventType, workflowId: parseInt(mappingForm.workflowId, 10),
        priority: mappingForm.priority, conditions: mappingForm.conditions || null,
        transformTemplate: mappingForm.transformTemplate || null, isActive: mappingForm.isActive,
      },
    });
  }

  function openCreateKey() {
    setKeyForm(INITIAL_KEY_FORM);
    apiKeyModal.open();
  }

  function handleCreateKey() {
    if (!keyForm.name.trim()) { toast.error('Name is required'); return; }
    const allowedIPs = keyForm.allowedIPs.trim()
      ? keyForm.allowedIPs.split('\n').map((ip) => ip.trim()).filter(Boolean)
      : null;
    createKeyMutation.mutate({
      name: keyForm.name, description: keyForm.description, permissions: keyForm.permissions,
      rateLimitPerMinute: keyForm.rateLimitPerMinute, expiresAt: keyForm.expiresAt || null, allowedIPs,
    });
  }

  // ===== Column definitions =====

  const wfColumns: ColumnDef<WorkWorkflow>[] = [
    {
      key: 'Name', label: 'Workflow', sortable: true, filterable: true,
      render: (_val, row) => (
        <div>
          <span className="font-medium text-dark-700">{row.Name}</span>
          {row.Description && <div className="text-xs text-dark-400">{row.Description}</div>}
        </div>
      ),
    },
    { key: 'N8NWorkflowId', label: 'N8N ID', width: 120, sortable: true, render: (val) => <code className="text-primary text-xs">{val}</code> },
    { key: 'TriggerType', label: 'Trigger', width: 100, sortable: true },
    { key: 'TimeoutMs', label: 'Timeout', width: 90, render: (val) => <span className="text-dark-400">{val ? (val / 1000) + 's' : '30s'}</span> },
    {
      key: 'IsActive', label: 'Status', width: 90, sortable: true,
      render: (val) => <StatusBadge status={val ? 'success' : 'neutral'} label={val ? 'Active' : 'Inactive'} size="sm" />,
    },
    {
      key: 'LastExecutedAt', label: 'Last Run', width: 160,
      render: (val) => <span className="text-xs text-dark-400">{val ? new Date(val).toLocaleString() : 'Never'}</span>,
    },
    {
      key: 'WorkflowId', label: 'Actions', width: 130, sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => execWfMutation.mutate(row.WorkflowId)} className="p-1.5 text-dark-400 hover:text-primary rounded hover:bg-dark-100" title="Execute"><Play className="w-4 h-4" /></button>
          <button type="button" onClick={() => openEditWf(row)} className="p-1.5 text-dark-400 hover:text-primary rounded hover:bg-dark-100" title="Edit"><Edit className="w-4 h-4" /></button>
          <button type="button" onClick={() => deleteWfModal.open(row)} className="p-1.5 text-dark-400 hover:text-danger rounded hover:bg-dark-100" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  const execColumns: ColumnDef<WorkExecution>[] = [
    { key: 'ExecutionId', label: 'ID', width: 70, sortable: true, render: (val) => <code className="text-xs text-dark-400">{val}</code> },
    { key: 'WorkflowName', label: 'Workflow', sortable: true, render: (val) => <span className="text-dark-600">{val || '-'}</span> },
    { key: 'EventType', label: 'Event', width: 140, render: (val) => val ? <code className="text-xs">{val}</code> : <span className="text-dark-400">-</span> },
    { key: 'SourceApp', label: 'Source', width: 90, render: (val) => <span className="text-dark-400">{val || '-'}</span> },
    {
      key: 'Status', label: 'Status', width: 90, sortable: true,
      render: (val) => {
        const map: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = { success: 'success', failed: 'danger', timeout: 'danger', pending: 'warning', running: 'info', cancelled: 'neutral' };
        return <StatusBadge status={map[val] || 'neutral'} label={val} size="sm" />;
      },
    },
    { key: 'StartedAt', label: 'Started', width: 160, render: (val) => <span className="text-xs text-dark-400">{val ? new Date(val).toLocaleString() : '-'}</span> },
    { key: 'DurationMs', label: 'Duration', width: 90, render: (val) => <span className="text-dark-400">{val ? (val / 1000).toFixed(2) + 's' : '-'}</span> },
    {
      key: 'ExecutionId' as any, label: 'Actions', width: 80, sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openExecDetail(row)} className="p-1.5 text-dark-400 hover:text-primary rounded hover:bg-dark-100" title="Details"><Eye className="w-4 h-4" /></button>
          {row.Status === 'failed' && (
            <button type="button" onClick={() => retryExecMutation.mutate(row.ExecutionId)} className="p-1.5 text-dark-400 hover:text-primary rounded hover:bg-dark-100" title="Retry"><RotateCcw className="w-4 h-4" /></button>
          )}
        </div>
      ),
    },
  ];

  const mappingColumns: ColumnDef<WorkEventMapping>[] = [
    { key: 'EventType', label: 'Event Type', sortable: true, filterable: true, render: (val) => <code className="text-primary text-xs">{val}</code> },
    { key: 'WorkflowName', label: 'Workflow', sortable: true, render: (val) => <span className="text-dark-600">{val || 'Unknown'}</span> },
    { key: 'Priority', label: 'Priority', width: 80, sortable: true },
    { key: 'Conditions', label: 'Conditions', width: 100, render: (val) => val && val !== '{}' ? <span className="text-warning">Yes</span> : <span className="text-dark-400">None</span> },
    { key: 'IsActive', label: 'Status', width: 90, sortable: true, render: (val) => <StatusBadge status={val ? 'success' : 'neutral'} label={val ? 'Active' : 'Inactive'} size="sm" /> },
    {
      key: 'MappingId', label: 'Actions', width: 100, sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openEditMapping(row)} className="p-1.5 text-dark-400 hover:text-primary rounded hover:bg-dark-100" title="Edit"><Edit className="w-4 h-4" /></button>
          <button type="button" onClick={() => deleteMappingModal.open(row)} className="p-1.5 text-dark-400 hover:text-danger rounded hover:bg-dark-100" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  const keyColumns: ColumnDef<WorkApiKey>[] = [
    {
      key: 'Name', label: 'Name', sortable: true, filterable: true,
      render: (_val, row) => (
        <div>
          <span className="font-medium text-dark-700">{row.Name}</span>
          {row.Description && <div className="text-xs text-dark-400">{row.Description}</div>}
        </div>
      ),
    },
    { key: 'KeyPrefix', label: 'Key', width: 120, render: (val) => <code className="text-primary text-xs">{val}...</code> },
    {
      key: 'Permissions', label: 'Permissions', width: 160,
      render: (val) => {
        const perms = Array.isArray(val) ? val : typeof val === 'string' ? JSON.parse(val) : [];
        return <span className="text-xs text-dark-400">{perms.join(', ') || '-'}</span>;
      },
    },
    { key: 'RateLimitPerMinute', label: 'Rate', width: 80, render: (val) => <span className="text-dark-400">{val || 100}/min</span> },
    { key: 'LastUsedAt', label: 'Last Used', width: 140, render: (val) => <span className="text-xs text-dark-400">{val ? new Date(val).toLocaleString() : 'Never'}</span> },
    { key: 'IsActive', label: 'Status', width: 90, sortable: true, render: (val) => <StatusBadge status={val ? 'success' : 'neutral'} label={val ? 'Active' : 'Revoked'} size="sm" /> },
    {
      key: 'ApiKeyId', label: 'Actions', width: 120, sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {row.IsActive && (
            <>
              <button type="button" onClick={() => { if (window.confirm('Rotate this API key?')) rotateKeyMutation.mutate(row.ApiKeyId); }} className="p-1.5 text-dark-400 hover:text-primary rounded hover:bg-dark-100" title="Rotate"><RefreshCw className="w-4 h-4" /></button>
              <button type="button" onClick={() => { if (window.confirm('Revoke this API key?')) revokeKeyMutation.mutate(row.ApiKeyId); }} className="p-1.5 text-dark-400 hover:text-warning rounded hover:bg-dark-100" title="Revoke"><Ban className="w-4 h-4" /></button>
            </>
          )}
          <button type="button" onClick={() => { if (window.confirm('Delete this API key?')) deleteKeyMutation.mutate(row.ApiKeyId); }} className="p-1.5 text-dark-400 hover:text-danger rounded hover:bg-dark-100" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  // ===== Render =====

  return (
    <div className="space-y-6">
      <PageHeader
        title="WorkIT Admin"
        description="Manage workflows, executions, event mappings, and API keys"
        icon={<Workflow className="w-5 h-5" />}
        actions={
          <StatusBadge status={serviceConnected ? 'success' : 'danger'} label={serviceConnected ? 'Connected' : 'Offline'} size="sm" />
        }
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab: Status */}
      {activeTab === 'status' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatusCard label="Service" value={serviceConnected ? 'Connected' : 'Offline'} status={serviceConnected ? 'success' : 'danger'} />
            <StatusCard label="N8N" value={n8nConnected ? 'Connected' : 'Disconnected'} status={n8nConnected ? 'success' : 'danger'} />
            <StatusCard label="Active Workflows" value={String(activeWfCount)} status={activeWfCount > 0 ? 'info' : 'neutral'} />
            <StatusCard label="Executions Today" value={String(execStats?.summary?.total || 0)} status={(execStats?.summary?.total || 0) > 0 ? 'success' : 'neutral'} />
          </div>

          {/* Execution stats */}
          {execStats?.summary && (
            <div className="grid grid-cols-5 gap-3">
              <MiniStat label="Total" value={execStats.summary.total} color="text-info" />
              <MiniStat label="Success" value={execStats.summary.success} color="text-success" />
              <MiniStat label="Failed" value={execStats.summary.failed} color="text-danger" />
              <MiniStat label="Pending" value={execStats.summary.pending} color="text-warning" />
              <MiniStat label="Running" value={execStats.summary.running} color="text-info" />
            </div>
          )}

          {/* Recent executions */}
          <Card title="Recent Executions">
            <DataTable<WorkExecution>
              id="admin-work-executions"
              columns={execColumns}
              data={executions.slice(0, 50)}
              rowKey="ExecutionId"
              emptyMessage="No executions found"
              emptyIcon={Workflow}
            />
          </Card>
        </div>
      )}

      {/* Tab: Workflows */}
      {activeTab === 'workflows' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button icon={<Plus className="w-4 h-4" />} onClick={openCreateWf}>New Workflow</Button>
          </div>
          {wfLoading ? <LoadingSpinner size="lg" /> : (
            <DataTable<WorkWorkflow>
              id="admin-work-workflows"
              columns={wfColumns}
              data={workflows}
              rowKey="WorkflowId"
              onRowClick={openEditWf}
              emptyMessage="No workflows registered"
              emptyIcon={Workflow}
              showFilters
            />
          )}
        </div>
      )}

      {/* Tab: Event Mappings */}
      {activeTab === 'mappings' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button icon={<Plus className="w-4 h-4" />} onClick={openCreateMapping}>New Mapping</Button>
          </div>
          {mappingsLoading ? <LoadingSpinner size="lg" /> : (
            <DataTable<WorkEventMapping>
              id="admin-work-mappings"
              columns={mappingColumns}
              data={mappings}
              rowKey="MappingId"
              onRowClick={openEditMapping}
              emptyMessage="No event mappings configured"
              emptyIcon={Workflow}
              showFilters
            />
          )}
        </div>
      )}

      {/* Tab: API Keys */}
      {activeTab === 'apikeys' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button icon={<Plus className="w-4 h-4" />} onClick={openCreateKey}>New API Key</Button>
          </div>
          {keysLoading ? <LoadingSpinner size="lg" /> : (
            <DataTable<WorkApiKey>
              id="admin-work-apikeys"
              columns={keyColumns}
              data={apiKeys}
              rowKey="ApiKeyId"
              emptyMessage="No API keys created"
              emptyIcon={Key}
              showFilters
            />
          )}
        </div>
      )}

      {/* Workflow Create/Edit Modal */}
      <Modal
        isOpen={workflowModal.isOpen}
        onClose={workflowModal.close}
        title={isEditingWf ? 'Edit Workflow' : 'New Workflow'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={workflowModal.close}>Cancel</Button>
            <Button onClick={handleSaveWf} loading={saveWfMutation.isPending}>{isEditingWf ? 'Save Changes' : 'Create'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Name" required>
              <input type="text" value={wfForm.name} onChange={(e) => setWfForm({ ...wfForm, name: e.target.value })} className="form-input" placeholder="My Workflow" />
            </FormField>
            <FormField label="N8N Workflow ID" required>
              <input type="text" value={wfForm.n8nWorkflowId} onChange={(e) => setWfForm({ ...wfForm, n8nWorkflowId: e.target.value })} className="form-input" placeholder="abc123" />
            </FormField>
          </div>
          <FormField label="Description">
            <input type="text" value={wfForm.description} onChange={(e) => setWfForm({ ...wfForm, description: e.target.value })} className="form-input" placeholder="Optional description" />
          </FormField>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Trigger Type">
              <select value={wfForm.triggerType} onChange={(e) => setWfForm({ ...wfForm, triggerType: e.target.value })} className="form-input" title="Trigger type">
                <option value="webhook">Webhook</option>
                <option value="event">Event</option>
                <option value="schedule">Schedule</option>
              </select>
            </FormField>
            <FormField label="Timeout (ms)">
              <input type="number" value={wfForm.timeoutMs} onChange={(e) => setWfForm({ ...wfForm, timeoutMs: parseInt(e.target.value) || 30000 })} className="form-input" />
            </FormField>
            <FormField label="Status">
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input type="checkbox" checked={wfForm.isActive} onChange={(e) => setWfForm({ ...wfForm, isActive: e.target.checked })} className="rounded border-dark-300 bg-dark-200 text-primary focus:ring-primary/50" />
                <span className="text-sm text-dark-600">Active</span>
              </label>
            </FormField>
          </div>
          <FormField label="Webhook URL">
            <input type="text" value={wfForm.webhookUrl} onChange={(e) => setWfForm({ ...wfForm, webhookUrl: e.target.value })} className="form-input" placeholder="Optional webhook URL" />
          </FormField>
        </div>
      </Modal>

      {/* Delete Workflow Modal */}
      <Modal isOpen={deleteWfModal.isOpen} onClose={deleteWfModal.close} title="Delete Workflow" size="sm"
        footer={<><Button variant="secondary" onClick={deleteWfModal.close}>Cancel</Button><Button variant="danger" onClick={() => deleteWfModal.data && deleteWfMutation.mutate(deleteWfModal.data.WorkflowId)} loading={deleteWfMutation.isPending}>Delete</Button></>}
      >
        <p className="text-sm text-dark-500">Delete <strong className="text-dark-700">{deleteWfModal.data?.Name}</strong>?</p>
      </Modal>

      {/* Execution Detail Modal */}
      <Modal isOpen={execDetailModal.isOpen} onClose={execDetailModal.close} title={`Execution #${execDetail?.ExecutionId || ''}`} size="lg">
        {execDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <DetailItem label="Workflow" value={execDetail.WorkflowName || '-'} />
              <DetailItem label="Status" value={execDetail.Status} />
              <DetailItem label="Started" value={execDetail.StartedAt ? new Date(execDetail.StartedAt).toLocaleString() : '-'} />
              <DetailItem label="Duration" value={execDetail.DurationMs ? (execDetail.DurationMs / 1000).toFixed(2) + 's' : '-'} />
              <DetailItem label="Source" value={execDetail.SourceApp || '-'} />
              <DetailItem label="GUID" value={execDetail.ExecutionGuid || '-'} />
            </div>
            {execDetail.ErrorMessage && (
              <div>
                <label className="block text-xs font-medium text-danger mb-1">Error</label>
                <pre className="bg-dark-100 rounded-lg p-3 text-xs text-danger font-mono overflow-auto max-h-[150px]">{execDetail.ErrorMessage}</pre>
              </div>
            )}
            {execDetail.InputPayload && (
              <div>
                <label className="block text-xs font-medium text-dark-500 mb-1">Input</label>
                <pre className="bg-dark-100 rounded-lg p-3 text-xs text-dark-500 font-mono overflow-auto max-h-[150px]">{tryFormatJson(execDetail.InputPayload)}</pre>
              </div>
            )}
            {execDetail.OutputPayload && (
              <div>
                <label className="block text-xs font-medium text-dark-500 mb-1">Output</label>
                <pre className="bg-dark-100 rounded-lg p-3 text-xs text-success font-mono overflow-auto max-h-[150px]">{tryFormatJson(execDetail.OutputPayload)}</pre>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Mapping Create/Edit Modal */}
      <Modal
        isOpen={mappingModal.isOpen}
        onClose={mappingModal.close}
        title={isEditingMapping ? 'Edit Event Mapping' : 'New Event Mapping'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={mappingModal.close}>Cancel</Button>
            <Button onClick={handleSaveMapping} loading={saveMappingMutation.isPending}>{isEditingMapping ? 'Save Changes' : 'Create'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Event Type" required>
              <input type="text" value={mappingForm.eventType} onChange={(e) => setMappingForm({ ...mappingForm, eventType: e.target.value })} className="form-input" placeholder="e.g., order.created" />
            </FormField>
            <FormField label="Workflow" required>
              <select value={mappingForm.workflowId} onChange={(e) => setMappingForm({ ...mappingForm, workflowId: e.target.value })} className="form-input" title="Workflow">
                <option value="">-- Select Workflow --</option>
                {workflows.map((wf) => <option key={wf.WorkflowId} value={wf.WorkflowId}>{wf.Name}</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Priority">
              <input type="number" value={mappingForm.priority} onChange={(e) => setMappingForm({ ...mappingForm, priority: parseInt(e.target.value) || 100 })} className="form-input" />
            </FormField>
            <FormField label="Status">
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input type="checkbox" checked={mappingForm.isActive} onChange={(e) => setMappingForm({ ...mappingForm, isActive: e.target.checked })} className="rounded border-dark-300 bg-dark-200 text-primary focus:ring-primary/50" />
                <span className="text-sm text-dark-600">Active</span>
              </label>
            </FormField>
          </div>
          <FormField label="Conditions (JSON)">
            <textarea value={mappingForm.conditions} onChange={(e) => setMappingForm({ ...mappingForm, conditions: e.target.value })} className="form-input font-mono text-sm" rows={3} placeholder='{"field": "value"}' />
          </FormField>
          <FormField label="Transform Template">
            <textarea value={mappingForm.transformTemplate} onChange={(e) => setMappingForm({ ...mappingForm, transformTemplate: e.target.value })} className="form-input font-mono text-sm" rows={3} placeholder="Optional transform template" />
          </FormField>
        </div>
      </Modal>

      {/* Delete Mapping Modal */}
      <Modal isOpen={deleteMappingModal.isOpen} onClose={deleteMappingModal.close} title="Delete Event Mapping" size="sm"
        footer={<><Button variant="secondary" onClick={deleteMappingModal.close}>Cancel</Button><Button variant="danger" onClick={() => deleteMappingModal.data && deleteMappingMutation.mutate(deleteMappingModal.data.MappingId)} loading={deleteMappingMutation.isPending}>Delete</Button></>}
      >
        <p className="text-sm text-dark-500">Delete mapping for <strong className="text-dark-700">{deleteMappingModal.data?.EventType}</strong>?</p>
      </Modal>

      {/* API Key Create Modal */}
      <Modal
        isOpen={apiKeyModal.isOpen}
        onClose={apiKeyModal.close}
        title="Create API Key"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={apiKeyModal.close}>Cancel</Button>
            <Button onClick={handleCreateKey} loading={createKeyMutation.isPending}>Create</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Name" required>
              <input type="text" value={keyForm.name} onChange={(e) => setKeyForm({ ...keyForm, name: e.target.value })} className="form-input" placeholder="N8N Callback Key" />
            </FormField>
            <FormField label="Rate Limit (/min)">
              <input type="number" value={keyForm.rateLimitPerMinute} onChange={(e) => setKeyForm({ ...keyForm, rateLimitPerMinute: parseInt(e.target.value) || 100 })} className="form-input" />
            </FormField>
          </div>
          <FormField label="Description">
            <input type="text" value={keyForm.description} onChange={(e) => setKeyForm({ ...keyForm, description: e.target.value })} className="form-input" placeholder="Optional description" />
          </FormField>
          <FormField label="Permissions">
            <div className="flex flex-wrap gap-3">
              {ALL_PERMISSIONS.map((perm) => (
                <label key={perm} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={keyForm.permissions.includes(perm)}
                    onChange={(e) => {
                      setKeyForm({
                        ...keyForm,
                        permissions: e.target.checked ? [...keyForm.permissions, perm] : keyForm.permissions.filter((p) => p !== perm),
                      });
                    }}
                    className="rounded border-dark-300 bg-dark-200 text-primary focus:ring-primary/50"
                  />
                  <span className="text-sm text-dark-600">{perm}</span>
                </label>
              ))}
            </div>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Expires At">
              <input type="date" value={keyForm.expiresAt} onChange={(e) => setKeyForm({ ...keyForm, expiresAt: e.target.value })} className="form-input" />
            </FormField>
          </div>
          <FormField label="Allowed IPs (one per line)">
            <textarea value={keyForm.allowedIPs} onChange={(e) => setKeyForm({ ...keyForm, allowedIPs: e.target.value })} className="form-input font-mono text-sm" rows={3} placeholder="Leave empty for no restriction" />
          </FormField>
        </div>
      </Modal>

      {/* Created Key Modal */}
      <Modal isOpen={createdKeyModal.isOpen} onClose={createdKeyModal.close} title="API Key Created" size="md">
        <div className="space-y-4">
          <p className="text-sm text-dark-500">Copy this key now. It will not be shown again.</p>
          <pre className="bg-dark-100 rounded-lg p-3 text-sm text-primary font-mono break-all">{createdKey}</pre>
          <Button
            onClick={() => { navigator.clipboard.writeText(createdKey); toast.success('Copied to clipboard'); }}
          >
            Copy to Clipboard
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ===== Local helpers =====

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-dark-500 mb-1">
        {label}{required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function StatusCard({ label, value, status }: { label: string; value: string; status: 'success' | 'danger' | 'warning' | 'info' | 'neutral' }) {
  return (
    <div className="bg-dark-50 border border-dark-200 rounded-xl p-4">
      <div className="text-xs text-dark-400 mb-1">{label}</div>
      <StatusBadge status={status} label={value} size="sm" />
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-dark-50 border border-dark-200 rounded-lg p-3 text-center">
      <div className={`text-xl font-bold ${value > 0 ? color : 'text-dark-400'}`}>{value}</div>
      <div className="text-xs text-dark-400">{label}</div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-dark-400 mb-0.5">{label}</label>
      <div className="text-sm text-dark-700">{value}</div>
    </div>
  );
}

function tryFormatJson(str: string): string {
  try { return JSON.stringify(JSON.parse(str), null, 2); } catch { return str; }
}
