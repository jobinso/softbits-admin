import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Workflow, Play, Edit, Trash2, Plus, Key, RefreshCw, RotateCcw, Ban, Eye, Database, ExternalLink, Wifi, WifiOff, Star, Layers, FileText, Mail, Globe, Clock, PackageMinus, AlertTriangle, ShoppingCart, Receipt, ChevronRight, Pause, FlaskConical, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
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
  TableFilterDropdown,
  TableColumnPicker,
  PageStatusBar,
} from '@/components/shared';
import type { TabItem, ColumnDef, TableFilterField, TableColumnPickerColumn } from '@/components/shared';
import { useModal } from '@shared/hooks';
import type { WorkWorkflow, WorkExecution, WorkEventMapping, WorkApiKey, Provider, WorkTemplate, WorkTemplateInstance } from '@/types';
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
  getProviders,
  getProvidersByApp,
  testProvider,
  getWorkTemplates,
  getWorkTemplateInstances,
  instantiateWorkTemplate,
  provisionWorkTemplate,
  testWorkTemplate,
  activateWorkTemplate,
  pauseWorkTemplate,
  archiveWorkTemplateInstance,
} from '@/services/admin-service';

// ===== Constants =====

const tabs: TabItem[] = [
  { id: 'status', label: 'Dashboard', icon: <Workflow className="w-4 h-4" /> },
  { id: 'workflows', label: 'Workflows', icon: <Play className="w-4 h-4" /> },
  { id: 'templates', label: 'Templates', icon: <Layers className="w-4 h-4" /> },
  { id: 'mappings', label: 'Event Mappings', icon: <Workflow className="w-4 h-4" /> },
  { id: 'automation', label: 'Provider', icon: <Database className="w-4 h-4" /> },
];

// Icon mapping for template icons (stored as string in DB)
const TEMPLATE_ICON_MAP: Record<string, React.ReactNode> = {
  FileText: <FileText className="w-6 h-6" />,
  Globe: <Globe className="w-6 h-6" />,
  Mail: <Mail className="w-6 h-6" />,
  ShoppingCart: <ShoppingCart className="w-6 h-6" />,
  Receipt: <Receipt className="w-6 h-6" />,
  AlertTriangle: <AlertTriangle className="w-6 h-6" />,
  Clock: <Clock className="w-6 h-6" />,
  PackageMinus: <PackageMinus className="w-6 h-6" />,
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  EMAIL: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Email' },
  WEBHOOK: { bg: 'bg-purple-500/10', text: 'text-purple-400', label: 'Webhook' },
  SCHEDULE: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Schedule' },
  EVENT: { bg: 'bg-teal-500/10', text: 'text-teal-400', label: 'Event' },
};

const INSTANCE_STATUS_MAP: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  active: 'success', paused: 'warning', error: 'danger', provisioning: 'info', draft: 'neutral', archived: 'neutral',
};

// ===== Form types =====

interface WorkflowForm {
  name: string;
  n8nWorkflowId: string;
  description: string;
  triggerType: string;
  timeoutMs: number;
  webhookUrl: string;
  isActive: boolean;
  providerId: string;
  templateId: number | null;
  templateName: string;
}

const INITIAL_WF_FORM: WorkflowForm = {
  name: '', n8nWorkflowId: '', description: '', triggerType: 'webhook',
  timeoutMs: 30000, webhookUrl: '', isActive: true, providerId: '',
  templateId: null, templateName: '',
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

  // Execution filters & column visibility
  const [execSearch, setExecSearch] = useState('');
  const [execFilters, setExecFilters] = useState<Record<string, string>>({});
  const [execColumnVisibility, setExecColumnVisibility] = useState<Record<string, boolean>>({});

  // Template modal
  const templateModal = useModal<WorkTemplate>();
  const [templateForm, setTemplateForm] = useState<{ name: string; configuration: Record<string, unknown>; providerId: string }>({ name: '', configuration: {}, providerId: '' });

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

  // ---- Execution filter handlers ----

  const handleExecFilterChange = (key: string, value: string) => {
    setExecFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearAllExecFilters = () => {
    setExecFilters({});
  };

  const toggleExecColumnVisibility = (key: string) => {
    setExecColumnVisibility((prev) => ({ ...prev, [key]: prev[key] === false ? true : false }));
  };

  const execFilterFields: TableFilterField[] = useMemo(() => [
    { key: 'WorkflowName', label: 'Workflow', type: 'text' },
    { key: 'EventType', label: 'Event', type: 'text' },
    { key: 'SourceApp', label: 'Source', type: 'text' },
    {
      key: 'Status', label: 'Status', type: 'select',
      options: [
        { value: 'success', label: 'Success' },
        { value: 'failed', label: 'Failed' },
        { value: 'timeout', label: 'Timeout' },
        { value: 'pending', label: 'Pending' },
        { value: 'running', label: 'Running' },
        { value: 'cancelled', label: 'Cancelled' },
      ],
    },
  ], []);

  const execPickerColumns: TableColumnPickerColumn[] = useMemo(() => [
    { key: 'ExecutionId', label: 'ID' },
    { key: 'WorkflowName', label: 'Workflow' },
    { key: 'EventType', label: 'Event' },
    { key: 'SourceApp', label: 'Source' },
    { key: 'Status', label: 'Status' },
    { key: 'StartedAt', label: 'Started' },
    { key: 'DurationMs', label: 'Duration' },
  ], []);

  const filteredExecData = useMemo(() => {
    let result = executions;
    if (execSearch) {
      const s = execSearch.toLowerCase();
      result = result.filter(
        (e) =>
          String(e.ExecutionId).includes(s) ||
          (e.WorkflowName && e.WorkflowName.toLowerCase().includes(s)) ||
          (e.EventType && e.EventType.toLowerCase().includes(s)) ||
          (e.SourceApp && e.SourceApp.toLowerCase().includes(s)) ||
          (e.Status && e.Status.toLowerCase().includes(s))
      );
    }
    const activeFilters = Object.entries(execFilters).filter(([, v]) => v);
    if (activeFilters.length > 0) {
      result = result.filter((row) =>
        activeFilters.every(([key, value]) => {
          const rowVal = (row as any)[key];
          if (rowVal == null) return false;
          const field = execFilterFields.find((f) => f.key === key);
          if (field?.type === 'select') return String(rowVal) === value;
          return String(rowVal).toLowerCase().includes(value.toLowerCase());
        })
      );
    }
    return result;
  }, [executions, execSearch, execFilters, execFilterFields]);

  const { data: automationProvidersData, isLoading: automationProvidersLoading } = useQuery({
    queryKey: ['admin', 'providers', { app: 'INFUSE' }],
    queryFn: () => getProvidersByApp('INFUSE'),
    enabled: activeTab === 'automation' || activeTab === 'workflows' || activeTab === 'templates',
  });

  const automationProviders: Provider[] = automationProvidersData?.data || [];

  // Template queries
  const { data: templatesData, isLoading: templatesLoading } = useQuery<{ templates: WorkTemplate[] }>({
    queryKey: ['admin', 'work', 'templates'],
    queryFn: () => getWorkTemplates(),
    retry: false,
    enabled: activeTab === 'templates' || activeTab === 'workflows',
  });

  const { data: instancesData, isLoading: instancesLoading } = useQuery<{ instances: WorkTemplateInstance[] }>({
    queryKey: ['admin', 'work', 'template-instances'],
    queryFn: () => getWorkTemplateInstances(),
    retry: false,
    enabled: activeTab === 'templates',
  });

  const templates: WorkTemplate[] = templatesData?.templates || [];
  const templateInstances: WorkTemplateInstance[] = instancesData?.instances || [];

  const serviceConnected = !!healthData;
  const n8nConnected = healthData?.checks?.n8n === 'ok';
  const [testingId, setTestingId] = useState<string | null>(null);
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

  const execWfMutation = useMutation({
    mutationFn: (id: number) => executeWorkWorkflow(id),
    onSuccess: (data: any) => { toast.success(`Execution started (ID: ${data?.executionId || 'N/A'})`); invalidateWork(); },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message || err?.message || 'Workflow execution failed'),
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

  const createKeyMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => createWorkApiKey(data),
    onSuccess: (data: any) => {
      apiKeyModal.close();
      setCreatedKey(data.apiKey?.key || '');
      createdKeyModal.open();
      invalidateWork();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rotateKeyMutation = useMutation({
    mutationFn: (id: number) => rotateWorkApiKey(id),
    onSuccess: (data: any) => {
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

  // Template mutations
  const instantiateMutation = useMutation({
    mutationFn: (data: { templateId: number; name: string; configuration?: Record<string, unknown>; providerId?: string }) =>
      instantiateWorkTemplate(data.templateId, { name: data.name, configuration: data.configuration, providerId: data.providerId }),
    onSuccess: () => { invalidateWork(); templateModal.close(); toast.success('Template instance created'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const provisionMutation = useMutation({
    mutationFn: (id: number) => provisionWorkTemplate(id),
    onSuccess: () => { invalidateWork(); toast.success('Workflow provisioned'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const testTemplateMutation = useMutation({
    mutationFn: (id: number) => testWorkTemplate(id),
    onSuccess: () => { invalidateWork(); toast.success('Test completed'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const activateMutation = useMutation({
    mutationFn: (id: number) => activateWorkTemplate(id),
    onSuccess: () => { invalidateWork(); toast.success('Instance activated'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const pauseMutation = useMutation({
    mutationFn: (id: number) => pauseWorkTemplate(id),
    onSuccess: () => { invalidateWork(); toast.success('Instance paused'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const archiveInstanceMutation = useMutation({
    mutationFn: (id: number) => archiveWorkTemplateInstance(id),
    onSuccess: () => { invalidateWork(); toast.success('Instance archived'); },
    onError: (err: Error) => toast.error(err.message),
  });

  // ===== Handlers =====

  function openInstantiateTemplate(template: WorkTemplate) {
    setTemplateForm({
      name: template.Name,
      configuration: (template.DefaultConfig && typeof template.DefaultConfig === 'object') ? { ...template.DefaultConfig } : {},
      providerId: '',
    });
    templateModal.open(template);
  }

  function handleInstantiate() {
    const template = templateModal.data;
    if (!template) return;
    if (!templateForm.name.trim()) { toast.error('Name is required'); return; }
    instantiateMutation.mutate({
      templateId: template.TemplateId,
      name: templateForm.name,
      configuration: templateForm.configuration,
      providerId: templateForm.providerId || undefined,
    });
  }

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
      webhookUrl: wf.WebhookUrl || '', isActive: wf.IsActive, providerId: wf.ProviderId || '',
      templateId: wf.TemplateId || null, templateName: wf.TemplateName || '',
    });
    setIsEditingWf(true);
    setEditingWfId(wf.WorkflowId);
    workflowModal.open(wf);
  }

  function handleSaveWf() {
    if (!wfForm.name.trim()) { toast.error('Name is required'); return; }
    if (wfForm.providerId && !wfForm.n8nWorkflowId.trim()) { toast.error('External ID is required when a provider is selected'); return; }
    const isInternal = !wfForm.providerId;
    const externalId = isInternal ? (wfForm.n8nWorkflowId || `INTERNAL-${Date.now()}`) : wfForm.n8nWorkflowId;
    saveWfMutation.mutate({
      id: editingWfId || undefined,
      payload: {
        name: wfForm.name, n8nWorkflowId: externalId, description: wfForm.description,
        triggerType: wfForm.triggerType, timeoutMs: wfForm.timeoutMs,
        webhookUrl: wfForm.webhookUrl, isActive: wfForm.isActive, providerId: wfForm.providerId || null,
        executionHandler: isInternal ? 'internal' : 'n8n',
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

  // ===== Column definitions =====

  const wfColumns: ColumnDef<WorkWorkflow>[] = [
    {
      key: 'Name', label: 'Workflow', sortable: true, filterable: true,
      render: (_val, row) => (
        <div>
          <span className="font-medium text-semantic-text-default">{row.Name}</span>
          {row.Description && <div className="text-xs text-semantic-text-faint">{row.Description}</div>}
        </div>
      ),
    },
    { key: 'TemplateName', label: 'Template', width: 140, sortable: true, render: (val) => val ? <span className="text-semantic-text-secondary text-xs">{val}</span> : <span className="text-semantic-text-faint text-xs">-</span> },
    { key: 'N8NWorkflowId', label: 'Type', width: 100, sortable: true, render: (val, row) => String(val || '').startsWith('INTERNAL') || row.ExecutionHandler === 'internal' ? <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">Internal</span> : <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-500/10 text-orange-400">External</span> },
    { key: 'TriggerType', label: 'Trigger', width: 100, sortable: true },
    {
      key: 'ProviderId', label: 'Provider', width: 140,
      render: (val) => {
        if (!val) return <span className="text-semantic-text-faint">Manual</span>;
        const p = automationProviders.find((pr) => pr.ProviderId === val);
        return <span className="text-semantic-text-secondary">{p?.Name || 'Unknown'}</span>;
      },
    },
    { key: 'TimeoutMs', label: 'Timeout', width: 90, render: (val) => <span className="text-semantic-text-faint">{val ? (val / 1000) + 's' : '30s'}</span> },
    {
      key: 'IsActive', label: 'Status', width: 90, sortable: true,
      render: (val) => <StatusBadge status={val ? 'success' : 'neutral'} label={val ? 'Active' : 'Inactive'} size="sm" />,
    },
    {
      key: 'LastExecutedAt', label: 'Last Run', width: 160,
      render: (val) => <span className="text-xs text-semantic-text-faint">{val ? new Date(val).toLocaleString() : 'Never'}</span>,
    },
    {
      key: 'WorkflowId', label: 'Actions', width: 130, sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => execWfMutation.mutate(row.WorkflowId)} className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover" title="Execute"><Play className="w-4 h-4" /></button>
          <button type="button" onClick={() => openEditWf(row)} className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover" title="Edit"><Edit className="w-4 h-4" /></button>
          <button type="button" onClick={() => deleteWfModal.open(row)} className="p-1.5 text-semantic-text-faint hover:text-danger rounded hover:bg-interactive-hover" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  const execColumns: ColumnDef<WorkExecution>[] = [
    { key: 'ExecutionId', label: 'ID', width: 70, sortable: true, hidden: execColumnVisibility.ExecutionId === false, render: (val) => <code className="text-xs text-semantic-text-faint">{val}</code> },
    { key: 'WorkflowName', label: 'Workflow', sortable: true, hidden: execColumnVisibility.WorkflowName === false, render: (val) => <span className="text-semantic-text-secondary">{val || '-'}</span> },
    { key: 'EventType', label: 'Event', width: 140, hidden: execColumnVisibility.EventType === false, render: (val) => val ? <code className="text-xs">{val}</code> : <span className="text-semantic-text-faint">-</span> },
    { key: 'SourceApp', label: 'Source', width: 90, hidden: execColumnVisibility.SourceApp === false, render: (val) => <span className="text-semantic-text-faint">{val || '-'}</span> },
    {
      key: 'Status', label: 'Status', width: 90, sortable: true, hidden: execColumnVisibility.Status === false,
      render: (val) => {
        const map: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = { success: 'success', failed: 'danger', timeout: 'danger', pending: 'warning', running: 'info', cancelled: 'neutral' };
        return <StatusBadge status={map[val] || 'neutral'} label={val} size="sm" />;
      },
    },
    { key: 'StartedAt', label: 'Started', width: 160, sortable: true, hidden: execColumnVisibility.StartedAt === false, render: (val) => <span className="text-xs text-semantic-text-faint">{val ? new Date(val).toLocaleString() : '-'}</span> },
    { key: 'DurationMs', label: 'Duration', width: 90, sortable: true, hidden: execColumnVisibility.DurationMs === false, render: (val) => <span className="text-semantic-text-faint">{val ? (val / 1000).toFixed(2) + 's' : '-'}</span> },
    {
      key: 'ExecutionId' as any, label: 'Actions', width: 80, sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openExecDetail(row)} className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover" title="Details"><Eye className="w-4 h-4" /></button>
          {row.Status === 'failed' && (
            <button type="button" onClick={() => retryExecMutation.mutate(row.ExecutionId)} className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover" title="Retry"><RotateCcw className="w-4 h-4" /></button>
          )}
        </div>
      ),
    },
  ];

  const mappingColumns: ColumnDef<WorkEventMapping>[] = [
    { key: 'EventType', label: 'Event Type', sortable: true, filterable: true, render: (val) => <code className="text-primary text-xs">{val}</code> },
    { key: 'WorkflowName', label: 'Workflow', sortable: true, render: (val) => <span className="text-semantic-text-secondary">{val || 'Unknown'}</span> },
    { key: 'Priority', label: 'Priority', width: 80, sortable: true },
    { key: 'Conditions', label: 'Conditions', width: 100, render: (val) => val && val !== '{}' ? <span className="text-warning">Yes</span> : <span className="text-semantic-text-faint">None</span> },
    { key: 'IsActive', label: 'Status', width: 90, sortable: true, render: (val) => <StatusBadge status={val ? 'success' : 'neutral'} label={val ? 'Active' : 'Inactive'} size="sm" /> },
    {
      key: 'MappingId', label: 'Actions', width: 100, sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openEditMapping(row)} className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover" title="Edit"><Edit className="w-4 h-4" /></button>
          <button type="button" onClick={() => deleteMappingModal.open(row)} className="p-1.5 text-semantic-text-faint hover:text-danger rounded hover:bg-interactive-hover" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  const keyColumns: ColumnDef<WorkApiKey>[] = [
    {
      key: 'Name', label: 'Name', sortable: true, filterable: true,
      render: (_val, row) => (
        <div>
          <span className="font-medium text-semantic-text-default">{row.Name}</span>
          {row.Description && <div className="text-xs text-semantic-text-faint">{row.Description}</div>}
        </div>
      ),
    },
    { key: 'KeyPrefix', label: 'Key', width: 120, render: (val) => <code className="text-primary text-xs">{val}...</code> },
    {
      key: 'Permissions', label: 'Permissions', width: 160,
      render: (val) => {
        const perms = Array.isArray(val) ? val : typeof val === 'string' ? JSON.parse(val) : [];
        return <span className="text-xs text-semantic-text-faint">{perms.join(', ') || '-'}</span>;
      },
    },
    { key: 'RateLimitPerMinute', label: 'Rate', width: 80, render: (val) => <span className="text-semantic-text-faint">{val || 100}/min</span> },
    { key: 'LastUsedAt', label: 'Last Used', width: 140, render: (val) => <span className="text-xs text-semantic-text-faint">{val ? new Date(val).toLocaleString() : 'Never'}</span> },
    { key: 'IsActive', label: 'Status', width: 90, sortable: true, render: (val) => <StatusBadge status={val ? 'success' : 'neutral'} label={val ? 'Active' : 'Revoked'} size="sm" /> },
    {
      key: 'ApiKeyId', label: 'Actions', width: 120, sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {row.IsActive && (
            <>
              <button type="button" onClick={() => { if (window.confirm('Rotate this API key?')) rotateKeyMutation.mutate(row.ApiKeyId); }} className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover" title="Rotate"><RefreshCw className="w-4 h-4" /></button>
              <button type="button" onClick={() => { if (window.confirm('Revoke this API key?')) revokeKeyMutation.mutate(row.ApiKeyId); }} className="p-1.5 text-semantic-text-faint hover:text-warning rounded hover:bg-interactive-hover" title="Revoke"><Ban className="w-4 h-4" /></button>
            </>
          )}
          <button type="button" onClick={() => { if (window.confirm('Delete this API key?')) deleteKeyMutation.mutate(row.ApiKeyId); }} className="p-1.5 text-semantic-text-faint hover:text-danger rounded hover:bg-interactive-hover" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  const automationProviderColumns: ColumnDef<Provider>[] = [
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
        const map: Record<string, 'success' | 'info' | 'neutral'> = { AI: 'success', AUTOMATION: 'info' };
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

  // ===== Render =====

  return (
    <div className="space-y-6">
      <PageHeader
        title="WorkIT"
        description="Work order and job management"
      />

      {/* Status Bar */}
      <PageStatusBar items={[
        { type: 'badge', label: 'Service', status: serviceConnected ? 'success' : 'danger', badgeLabel: serviceConnected ? 'Connected' : 'Offline' },
        { type: 'badge', label: 'N8N', status: n8nConnected ? 'success' : 'danger', badgeLabel: n8nConnected ? 'Connected' : 'Disconnected' },
        { type: 'text', label: 'Active Workflows', value: activeWfCount },
        { type: 'text', label: 'Executions Today', value: execStats?.summary?.total || 0 },
        { type: 'text', label: 'Failed', value: execStats?.summary?.failed || 0, colorClass: (execStats?.summary?.failed || 0) > 0 ? 'text-danger' : 'text-semantic-text-faint' },
        { type: 'text', label: 'Pending', value: execStats?.summary?.pending || 0, colorClass: (execStats?.summary?.pending || 0) > 0 ? 'text-warning' : 'text-semantic-text-faint' },
      ]} />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab: Status */}
      {activeTab === 'status' && (
        <div className="space-y-6">
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
          <TableCard
            title="Recent Executions"
            icon={<Workflow className="w-4 h-4" />}
            count={filteredExecData.length}
            search={{ value: execSearch, onChange: setExecSearch, placeholder: "Search executions..." }}
            headerActions={
              <div className="flex items-center gap-1">
                <TableFilterDropdown
                  fields={execFilterFields}
                  values={execFilters}
                  onChange={handleExecFilterChange}
                  onClearAll={handleClearAllExecFilters}
                />
                <TableColumnPicker
                  columns={execPickerColumns}
                  visibility={execColumnVisibility}
                  onToggle={toggleExecColumnVisibility}
                />
              </div>
            }
          >
            <DataTable<WorkExecution>
              id="admin-work-executions"
              columns={execColumns}
              data={filteredExecData}
              rowKey="ExecutionId"
              emptyMessage="No executions found"
              emptyIcon={Workflow}
              embedded
              pageSize={25}
              pageSizeOptions={[10, 25, 50, 100]}
              showFilters={false}
              showColumnPicker={false}
            />
          </TableCard>
        </div>
      )}

      {/* Tab: Workflows */}
      {activeTab === 'workflows' && (
        <TableCard
          title="Workflows"
          icon={<Play className="w-4 h-4" />}
          count={workflows.length}
          headerActions={
            <Button icon={<Plus className="w-4 h-4" />} onClick={openCreateWf}>New Workflow</Button>
          }
        >
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
              embedded
              showColumnPicker={false}
            />
          )}
        </TableCard>
      )}

      {/* Tab: Templates */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          {templatesLoading ? <LoadingSpinner size="lg" /> : (
            <>
              {/* Template Catalog */}
              {Object.entries(
                templates.reduce<Record<string, WorkTemplate[]>>((acc, t) => {
                  const cat = t.Category || 'OTHER';
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(t);
                  return acc;
                }, {})
              ).map(([category, catTemplates]) => {
                const catInfo = CATEGORY_COLORS[category] || { bg: 'bg-neutral-500/10', text: 'text-neutral-400', label: category };
                return (
                  <div key={category}>
                    <h3 className="text-sm font-semibold text-semantic-text-subtle mb-3 flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${catInfo.bg} ${catInfo.text}`}>{catInfo.label}</span>
                      <span className="text-semantic-text-faint text-xs">({catTemplates.length} template{catTemplates.length !== 1 ? 's' : ''})</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {catTemplates.map((template) => {
                        const instanceCount = templateInstances.filter((i) => i.TemplateId === template.TemplateId && i.Status !== 'archived').length;
                        const steps = Array.isArray(template.StepDefinitions) ? template.StepDefinitions : [];
                        return (
                          <div key={template.TemplateId} className="bg-surface-raised border border-border rounded-xl p-4 hover:border-primary/30 transition-colors">
                            <div className="flex items-start gap-3 mb-3">
                              <div className={`p-2 rounded-lg ${catInfo.bg} ${catInfo.text} shrink-0`}>
                                {TEMPLATE_ICON_MAP[template.Icon] || <Layers className="w-6 h-6" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="text-sm font-semibold text-semantic-text-default truncate">{template.Name}</h4>
                                <p className="text-xs text-semantic-text-faint mt-0.5 line-clamp-2">{template.Description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-semantic-text-faint mb-3">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${template.ExecutionHandler === 'n8n' ? 'bg-orange-500/10 text-orange-400' : 'bg-primary/10 text-primary'}`}>
                                {template.ExecutionHandler === 'n8n' ? 'N8N' : 'Internal'}
                              </span>
                              <span>{steps.length} step{steps.length !== 1 ? 's' : ''}</span>
                              <span>v{template.Version}</span>
                              {instanceCount > 0 && <span className="text-primary">{instanceCount} active</span>}
                            </div>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {steps.map((step, i) => (
                                <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-surface-overlay text-semantic-text-faint">
                                  <ChevronRight className="w-2.5 h-2.5" />{step.label}
                                </span>
                              ))}
                            </div>
                            <Button size="sm" variant="secondary" className="w-full" onClick={() => openInstantiateTemplate(template)}>
                              Use Template
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {templates.length === 0 && (
                <Card className="p-12 text-center">
                  <Layers className="w-10 h-10 text-semantic-text-faint mx-auto mb-3" />
                  <p className="text-sm text-semantic-text-subtle">No workflow templates available</p>
                </Card>
              )}

              {/* Template Instances */}
              {templateInstances.length > 0 && (
                <TableCard
                  title="Active Instances"
                  icon={<Zap className="w-4 h-4" />}
                  count={templateInstances.filter((i) => i.Status !== 'archived').length}
                >
                  {instancesLoading ? <LoadingSpinner size="lg" /> : (
                    <div className="divide-y divide-border">
                      {templateInstances.filter((i) => i.Status !== 'archived').map((instance) => (
                        <div key={instance.InstanceId} className="px-4 py-3 flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-semantic-text-default truncate">{instance.Name}</span>
                              <StatusBadge status={INSTANCE_STATUS_MAP[instance.Status] || 'neutral'} label={instance.Status} size="sm" />
                            </div>
                            <div className="text-xs text-semantic-text-faint mt-0.5">
                              {instance.TemplateName || `Template #${instance.TemplateId}`}
                              {instance.CreatedAt && <> &middot; Created {new Date(instance.CreatedAt).toLocaleDateString()}</>}
                            </div>
                            {instance.ErrorMessage && (
                              <p className="text-xs text-danger mt-1 truncate">{instance.ErrorMessage}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {instance.Status === 'draft' && (
                              <button type="button" onClick={() => provisionMutation.mutate(instance.InstanceId)} className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover" title="Provision">
                                <Zap className="w-4 h-4" />
                              </button>
                            )}
                            {(instance.Status === 'draft' || instance.Status === 'active' || instance.Status === 'paused') && (
                              <button type="button" onClick={() => testTemplateMutation.mutate(instance.InstanceId)} className="p-1.5 text-semantic-text-faint hover:text-info rounded hover:bg-interactive-hover" title="Test">
                                <FlaskConical className="w-4 h-4" />
                              </button>
                            )}
                            {(instance.Status === 'provisioning' || instance.Status === 'paused') && (
                              <button type="button" onClick={() => activateMutation.mutate(instance.InstanceId)} className="p-1.5 text-semantic-text-faint hover:text-success rounded hover:bg-interactive-hover" title="Activate">
                                <Play className="w-4 h-4" />
                              </button>
                            )}
                            {instance.Status === 'active' && (
                              <button type="button" onClick={() => pauseMutation.mutate(instance.InstanceId)} className="p-1.5 text-semantic-text-faint hover:text-warning rounded hover:bg-interactive-hover" title="Pause">
                                <Pause className="w-4 h-4" />
                              </button>
                            )}
                            <button type="button" onClick={() => { if (window.confirm('Archive this instance?')) archiveInstanceMutation.mutate(instance.InstanceId); }} className="p-1.5 text-semantic-text-faint hover:text-danger rounded hover:bg-interactive-hover" title="Archive">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TableCard>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab: Event Mappings */}
      {activeTab === 'mappings' && (
        <TableCard
          title="Event Mappings"
          icon={<Workflow className="w-4 h-4" />}
          count={mappings.length}
          headerActions={
            <Button icon={<Plus className="w-4 h-4" />} onClick={openCreateMapping}>New Mapping</Button>
          }
        >
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
              embedded
              showColumnPicker={false}
            />
          )}
        </TableCard>
      )}

      {/* Tab: API Keys */}
      {activeTab === 'apikeys' && (
        <TableCard
          title="API Keys"
          icon={<Key className="w-4 h-4" />}
          count={apiKeys.length}
          headerActions={
            <Button icon={<Plus className="w-4 h-4" />} onClick={openCreateKey}>New API Key</Button>
          }
        >
          {keysLoading ? <LoadingSpinner size="lg" /> : (
            <DataTable<WorkApiKey>
              id="admin-work-apikeys"
              columns={keyColumns}
              data={apiKeys}
              rowKey="ApiKeyId"
              emptyMessage="No API keys created"
              emptyIcon={Key}
              showFilters
              embedded
              showColumnPicker={false}
            />
          )}
        </TableCard>
      )}

      {/* Tab: Providers */}
      {activeTab === 'automation' && (
        <TableCard
          title="Providers"
          icon={<Database className="w-4 h-4" />}
          count={automationProviders.length}
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
          {automationProvidersLoading ? <LoadingSpinner size="lg" /> : (
            <DataTable<Provider>
              id="admin-work-providers"
              columns={automationProviderColumns}
              data={automationProviders}
              rowKey="ProviderId"
              emptyMessage="No providers assigned to InfuseIT"
              emptyIcon={Database}
              embedded
              showColumnPicker={false}
            />
          )}
        </TableCard>
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
          {/* Template — read-only when editing, dropdown when creating */}
          {isEditingWf ? (
            wfForm.templateName && (
              <FormField label="Template">
                <input type="text" value={wfForm.templateName} className="form-input bg-surface-subtle text-semantic-text-subtle" disabled />
              </FormField>
            )
          ) : (
            <FormField label="Template">
              <select
                value={wfForm.templateId ?? ''}
                onChange={(e) => {
                  const tid = e.target.value ? parseInt(e.target.value) : null;
                  const tmpl = templates.find((t) => t.TemplateId === tid);
                  setWfForm({ ...wfForm, templateId: tid, templateName: tmpl?.Name || '' });
                }}
                className="form-input"
                title="Template"
              >
                <option value="">-- None (standalone workflow) --</option>
                {templates.map((t) => (
                  <option key={t.TemplateId} value={t.TemplateId}>{t.Name}</option>
                ))}
              </select>
            </FormField>
          )}
          <FormField label="Automation Provider">
            {isEditingWf && wfForm.templateId ? (
              <input
                type="text"
                value={automationProviders.find((p) => p.ProviderId === wfForm.providerId)?.Name || '-- None (internal workflow) --'}
                readOnly
                disabled
                className="form-input bg-surface-subtle text-content-secondary cursor-not-allowed"
                title="Provider is set by the template and cannot be changed here"
              />
            ) : (
              <select
                value={wfForm.providerId}
                onChange={(e) => {
                  const pid = e.target.value;
                  const provider = automationProviders.find((p) => p.ProviderId === pid);
                  const config = provider?.Configuration as Record<string, string> | undefined;
                  const webhookUrl = config ? `${config.baseUrl || ''}${config.webhookPath || ''}` : '';
                  setWfForm({ ...wfForm, providerId: pid, webhookUrl: webhookUrl || wfForm.webhookUrl, n8nWorkflowId: pid ? wfForm.n8nWorkflowId : '' });
                }}
                className="form-input"
                title="Automation provider"
              >
                <option value="">-- None (internal workflow) --</option>
                {automationProviders.map((p) => (
                  <option key={p.ProviderId} value={p.ProviderId}>{p.Name}</option>
                ))}
              </select>
            )}
          </FormField>
          {wfForm.providerId && (
            <>
              <FormField label="External ID" required>
                <input type="text" value={wfForm.n8nWorkflowId} onChange={(e) => setWfForm({ ...wfForm, n8nWorkflowId: e.target.value })} className="form-input" placeholder="External workflow ID" />
              </FormField>
              <FormField label="Webhook URL">
                <input type="text" value={wfForm.webhookUrl} onChange={(e) => setWfForm({ ...wfForm, webhookUrl: e.target.value })} className="form-input" placeholder="Optional webhook URL" />
              </FormField>
            </>
          )}
          <FormField label="Name" required>
            <input type="text" value={wfForm.name} onChange={(e) => setWfForm({ ...wfForm, name: e.target.value })} className="form-input" placeholder="My Workflow" />
          </FormField>
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
                <input type="checkbox" checked={wfForm.isActive} onChange={(e) => setWfForm({ ...wfForm, isActive: e.target.checked })} className="rounded border-border bg-surface-subtle text-primary focus:ring-interactive-focus-ring" />
                <span className="text-sm text-semantic-text-secondary">Active</span>
              </label>
            </FormField>
          </div>
        </div>
      </Modal>

      {/* Delete Workflow Modal */}
      <Modal isOpen={deleteWfModal.isOpen} onClose={deleteWfModal.close} title="Delete Workflow" size="sm"
        footer={<><Button variant="secondary" onClick={deleteWfModal.close}>Cancel</Button><Button variant="danger" onClick={() => deleteWfModal.data && deleteWfMutation.mutate(deleteWfModal.data.WorkflowId)} loading={deleteWfMutation.isPending}>Delete</Button></>}
      >
        <p className="text-sm text-semantic-text-subtle">Delete <strong className="text-semantic-text-default">{deleteWfModal.data?.Name}</strong>?</p>
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
                <pre className="bg-surface-overlay rounded-lg p-3 text-xs text-danger font-mono overflow-auto max-h-[150px]">{execDetail.ErrorMessage}</pre>
              </div>
            )}
            {execDetail.InputPayload && (
              <div>
                <label className="block text-xs font-medium text-semantic-text-subtle mb-1">Input</label>
                <pre className="bg-surface-overlay rounded-lg p-3 text-xs text-semantic-text-subtle font-mono overflow-auto max-h-[150px]">{tryFormatJson(execDetail.InputPayload)}</pre>
              </div>
            )}
            {execDetail.OutputPayload && (
              <div>
                <label className="block text-xs font-medium text-semantic-text-subtle mb-1">Output</label>
                <pre className="bg-surface-overlay rounded-lg p-3 text-xs text-success font-mono overflow-auto max-h-[150px]">{tryFormatJson(execDetail.OutputPayload)}</pre>
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
                <input type="checkbox" checked={mappingForm.isActive} onChange={(e) => setMappingForm({ ...mappingForm, isActive: e.target.checked })} className="rounded border-border bg-surface-subtle text-primary focus:ring-interactive-focus-ring" />
                <span className="text-sm text-semantic-text-secondary">Active</span>
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
        <p className="text-sm text-semantic-text-subtle">Delete mapping for <strong className="text-semantic-text-default">{deleteMappingModal.data?.EventType}</strong>?</p>
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
                    className="rounded border-border bg-surface-subtle text-primary focus:ring-interactive-focus-ring"
                  />
                  <span className="text-sm text-semantic-text-secondary">{perm}</span>
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
          <p className="text-sm text-semantic-text-subtle">Copy this key now. It will not be shown again.</p>
          <pre className="bg-surface-overlay rounded-lg p-3 text-sm text-primary font-mono break-all">{createdKey}</pre>
          <Button
            onClick={() => { navigator.clipboard.writeText(createdKey); toast.success('Copied to clipboard'); }}
          >
            Copy to Clipboard
          </Button>
        </div>
      </Modal>

      {/* Template Instantiation Modal */}
      <Modal
        isOpen={templateModal.isOpen}
        onClose={templateModal.close}
        title={`Use Template: ${templateModal.data?.Name || ''}`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={templateModal.close}>Cancel</Button>
            <Button onClick={handleInstantiate} loading={instantiateMutation.isPending}>Create Instance</Button>
          </>
        }
      >
        {templateModal.data && (
          <div className="space-y-4">
            <p className="text-sm text-semantic-text-subtle">{templateModal.data.Description}</p>

            <FormField label="Instance Name" required>
              <input type="text" value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} className="form-input" placeholder="My workflow instance" />
            </FormField>

            {/* Provider selector for EMAIL templates */}
            {templateModal.data.RequiredProviderTypes?.length > 0 && (
              <FormField label="Provider">
                <select
                  value={templateForm.providerId}
                  onChange={(e) => setTemplateForm({ ...templateForm, providerId: e.target.value })}
                  className="form-input"
                  title="Provider"
                >
                  <option value="">-- Select Provider --</option>
                  {automationProviders
                    .filter((p) => templateModal.data!.RequiredProviderTypes.includes(p.ProviderTypeCode))
                    .map((p) => <option key={p.ProviderId} value={p.ProviderId}>{p.Name}</option>)}
                </select>
              </FormField>
            )}

            {/* Dynamic configuration fields from StepDefinitions */}
            <div>
              <h4 className="text-xs font-semibold text-semantic-text-subtle mb-2 uppercase tracking-wide">Configuration</h4>
              <div className="space-y-3">
                {(Array.isArray(templateModal.data.StepDefinitions) ? templateModal.data.StepDefinitions : []).flatMap((step) =>
                  (step.configFields || []).map((field) => {
                    const value = templateForm.configuration[field.name] ?? field.default ?? '';
                    return (
                      <FormField key={field.name} label={`${step.label} - ${field.name}`} required={field.required}>
                        {field.type === 'boolean' ? (
                          <label className="flex items-center gap-2 mt-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!value}
                              onChange={(e) => setTemplateForm({ ...templateForm, configuration: { ...templateForm.configuration, [field.name]: e.target.checked } })}
                              className="rounded border-border bg-surface-subtle text-primary focus:ring-interactive-focus-ring"
                            />
                            <span className="text-sm text-semantic-text-secondary">{String(value)}</span>
                          </label>
                        ) : field.type === 'number' ? (
                          <input
                            type="number"
                            value={String(value)}
                            onChange={(e) => setTemplateForm({ ...templateForm, configuration: { ...templateForm.configuration, [field.name]: parseInt(e.target.value) || 0 } })}
                            className="form-input"
                          />
                        ) : field.type === 'select' && field.options ? (
                          <select
                            value={String(value)}
                            onChange={(e) => setTemplateForm({ ...templateForm, configuration: { ...templateForm.configuration, [field.name]: e.target.value } })}
                            className="form-input"
                            title={field.name}
                          >
                            {field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={String(value)}
                            onChange={(e) => setTemplateForm({ ...templateForm, configuration: { ...templateForm.configuration, [field.name]: e.target.value } })}
                            className="form-input"
                            placeholder={field.default !== undefined ? String(field.default) : ''}
                          />
                        )}
                      </FormField>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
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

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-surface-raised border border-border rounded-lg p-3 text-center">
      <div className={`text-xl font-bold ${value > 0 ? color : 'text-semantic-text-faint'}`}>{value}</div>
      <div className="text-xs text-semantic-text-faint">{label}</div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-semantic-text-faint mb-0.5">{label}</label>
      <div className="text-sm text-semantic-text-default">{value}</div>
    </div>
  );
}

function tryFormatJson(str: string): string {
  try { return JSON.stringify(JSON.parse(str), null, 2); } catch { return str; }
}
