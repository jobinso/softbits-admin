import { useState, useMemo, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRightLeft, Network, Users, FileSpreadsheet, Settings, AlertTriangle,
  Plus, Edit, Trash2, Wifi, WifiOff, RefreshCw, RotateCcw, Eye, Play,
  ChevronRight, Upload, Wand2, CheckCircle, XCircle, Clock, ChevronDown,
} from 'lucide-react';
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
import type {
  EditVanProvider, EditTradingPartner, EditTransaction, EditDocumentStage,
  EditErrorLog, EditTransactionType, EditFormatSpec, EditFormatSpecField,
  EditWorkflowProviderConfig, EditDashboardSummary, EditDashboardStats,
} from '@/types';
import {
  getEditHealth,
  getEditVanProviders, createEditVanProvider, updateEditVanProvider, deleteEditVanProvider,
  testEditVanProvider, pollEditVanProvider,
  getEditTradingPartners, createEditTradingPartner, updateEditTradingPartner, deleteEditTradingPartner,
  getEditTransactions, getEditTransactionFlow,
  retryEditTransaction, reprocessEditTransaction,
  getEditDashboardSummary, getEditDashboardStats, getEditRecentErrors,
  getEditTransactionTypes,
  getEditFormatSpecs, importEditFormatSpec, autoMapEditFormatSpec,
  generateEditFieldMaps, deleteEditFormatSpec, getEditFormatSpecFields,
  getEditWorkflowProviders, testEditWorkflowProvider,
} from '@/services/admin-service';

// ===== Constants =====

const tabs: TabItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <ArrowRightLeft className="w-4 h-4" /> },
  { id: 'transactions', label: 'Transactions', icon: <Clock className="w-4 h-4" /> },
  { id: 'vans', label: 'VAN Providers', icon: <Network className="w-4 h-4" /> },
  { id: 'partners', label: 'Trading Partners', icon: <Users className="w-4 h-4" /> },
  { id: 'formats', label: 'Format Specs', icon: <FileSpreadsheet className="w-4 h-4" /> },
  { id: 'config', label: 'Configuration', icon: <Settings className="w-4 h-4" /> },
  { id: 'errors', label: 'Error Log', icon: <AlertTriangle className="w-4 h-4" /> },
];

const TX_STATUS_MAP: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  COMPLETED: 'success', FAILED: 'danger', POSTING: 'warning', TRANSFORMING: 'info',
  VALIDATING: 'info', RECEIVING: 'info', PENDING: 'neutral', ACKNOWLEDGED: 'success',
};

const MAPPING_STATUS_MAP: Record<string, 'success' | 'danger' | 'warning'> = {
  COMPLETE: 'success', UNMAPPED: 'danger', PARTIAL: 'warning',
};

const SEVERITY_MAP: Record<string, 'danger' | 'warning' | 'info'> = {
  CRITICAL: 'danger', ERROR: 'warning', WARNING: 'info',
};

// ===== Form types =====

interface VanForm {
  vanCode: string;
  vanName: string;
  vanType: string;
  documentFormat: string;
  pollEnabled: boolean;
  pollIntervalMinutes: number;
  isActive: boolean;
}

const INITIAL_VAN_FORM: VanForm = {
  vanCode: '', vanName: '', vanType: 'AS2', documentFormat: 'X12',
  pollEnabled: false, pollIntervalMinutes: 15, isActive: true,
};

interface PartnerForm {
  partnerCode: string;
  companyName: string;
  vanId: string;
  defaultFormat: string;
  workflowProvider: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
  isActive: boolean;
}

const INITIAL_PARTNER_FORM: PartnerForm = {
  partnerCode: '', companyName: '', vanId: '', defaultFormat: 'X12',
  workflowProvider: '', contactEmail: '', contactPhone: '', notes: '', isActive: true,
};

interface ImportForm {
  fileName: string;
  fileContent: string;
  partnerCode: string;
  typeCode: string;
}

const INITIAL_IMPORT_FORM: ImportForm = {
  fileName: '', fileContent: '', partnerCode: '', typeCode: '',
};

// ===== Pipeline Flow Component =====

function PipelineFlow({ stages }: { stages: EditDocumentStage[] }) {
  const sorted = [...stages].sort((a, b) => a.StageOrder - b.StageOrder);
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-4">
      {sorted.map((stage, i) => (
        <Fragment key={stage.StageId}>
          {i > 0 && <ChevronRight className="w-4 h-4 text-dark-300 flex-shrink-0" />}
          <div className={`flex-shrink-0 rounded-lg border px-3 py-2 text-center min-w-[100px] ${getStageClasses(stage.Status)}`}>
            <div className="text-xs font-medium">{stage.StageName}</div>
            <div className="text-[10px] mt-0.5">{stage.DurationMs ? `${stage.DurationMs}ms` : '\u2014'}</div>
            {stage.Status === 'FAILED' && stage.ErrorMessage && (
              <div className="text-[10px] mt-1 text-red-400 truncate max-w-[120px]" title={stage.ErrorMessage}>
                {stage.ErrorMessage}
              </div>
            )}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

function getStageClasses(status: string): string {
  switch (status) {
    case 'SUCCESS': return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
    case 'FAILED': return 'border-red-500/30 bg-red-500/10 text-red-400';
    case 'RUNNING': return 'border-blue-500/30 bg-blue-500/10 text-blue-400';
    case 'SKIPPED': return 'border-dark-200 bg-dark-100 text-dark-300';
    default: return 'border-dark-200 bg-dark-50 text-dark-300';
  }
}

// ===== Component =====

export default function EditAdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('dashboard');

  // VAN modal
  const vanModal = useModal<EditVanProvider>();
  const deleteVanModal = useModal<EditVanProvider>();
  const [vanForm, setVanForm] = useState<VanForm>(INITIAL_VAN_FORM);
  const [isEditingVan, setIsEditingVan] = useState(false);
  const [editingVanId, setEditingVanId] = useState<string | null>(null);

  // Partner modal
  const partnerModal = useModal<EditTradingPartner>();
  const deletePartnerModal = useModal<EditTradingPartner>();
  const [partnerForm, setPartnerForm] = useState<PartnerForm>(INITIAL_PARTNER_FORM);
  const [isEditingPartner, setIsEditingPartner] = useState(false);
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);

  // Transaction detail modal
  const txDetailModal = useModal<EditTransaction>();
  const [txFlow, setTxFlow] = useState<EditDocumentStage[]>([]);

  // Transaction filters
  const [txStatusFilter, setTxStatusFilter] = useState('');
  const [txPartnerFilter, setTxPartnerFilter] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState('');

  // Format spec import modal & field modal
  const importModal = useModal();
  const [importForm, setImportForm] = useState<ImportForm>(INITIAL_IMPORT_FORM);
  const fieldsModal = useModal<EditFormatSpec>();
  const [specFields, setSpecFields] = useState<EditFormatSpecField[]>([]);

  // Error log filters
  const [errorSeverityFilter, setErrorSeverityFilter] = useState('');
  const [errorResolvedFilter, setErrorResolvedFilter] = useState('');

  // Testing state
  const [testingVanId, setTestingVanId] = useState<string | null>(null);
  const [pollingVanId, setPollingVanId] = useState<string | null>(null);
  const [testingWfpId, setTestingWfpId] = useState<string | null>(null);

  // Expanded partner rows
  const [expandedPartners, setExpandedPartners] = useState<Set<string>>(new Set());

  // ===== Queries =====

  const { data: healthData } = useQuery({
    queryKey: ['admin', 'edit', 'health'],
    queryFn: getEditHealth,
    retry: false,
    refetchInterval: 15000,
  });

  const { data: dashboardSummary } = useQuery<EditDashboardSummary>({
    queryKey: ['admin', 'edit', 'dashboard', 'summary'],
    queryFn: getEditDashboardSummary,
    retry: false,
    enabled: activeTab === 'dashboard',
  });

  const { data: dashboardStats } = useQuery<EditDashboardStats>({
    queryKey: ['admin', 'edit', 'dashboard', 'stats'],
    queryFn: getEditDashboardStats,
    retry: false,
    enabled: activeTab === 'dashboard',
  });

  const { data: recentErrors } = useQuery<EditErrorLog[]>({
    queryKey: ['admin', 'edit', 'recentErrors'],
    queryFn: () => getEditRecentErrors(10),
    retry: false,
    enabled: activeTab === 'dashboard' || activeTab === 'errors',
  });

  const { data: transactionsData, isLoading: txLoading } = useQuery<EditTransaction[]>({
    queryKey: ['admin', 'edit', 'transactions'],
    queryFn: () => getEditTransactions(),
    retry: false,
    enabled: activeTab === 'transactions' || activeTab === 'dashboard',
  });

  const { data: vansData, isLoading: vansLoading } = useQuery<EditVanProvider[]>({
    queryKey: ['admin', 'edit', 'vans'],
    queryFn: getEditVanProviders,
    retry: false,
    enabled: activeTab === 'vans' || activeTab === 'partners' || activeTab === 'dashboard',
  });

  const { data: partnersData, isLoading: partnersLoading } = useQuery<EditTradingPartner[]>({
    queryKey: ['admin', 'edit', 'partners'],
    queryFn: getEditTradingPartners,
    retry: false,
    enabled: activeTab === 'partners' || activeTab === 'transactions' || activeTab === 'dashboard',
  });

  const { data: txTypesData } = useQuery<EditTransactionType[]>({
    queryKey: ['admin', 'edit', 'transactionTypes'],
    queryFn: getEditTransactionTypes,
    retry: false,
    enabled: activeTab === 'config' || activeTab === 'formats',
  });

  const { data: formatSpecsData, isLoading: specsLoading } = useQuery<EditFormatSpec[]>({
    queryKey: ['admin', 'edit', 'formatSpecs'],
    queryFn: getEditFormatSpecs,
    retry: false,
    enabled: activeTab === 'formats',
  });

  const { data: wfProvidersData, isLoading: wfpLoading } = useQuery<EditWorkflowProviderConfig[]>({
    queryKey: ['admin', 'edit', 'workflowProviders'],
    queryFn: getEditWorkflowProviders,
    retry: false,
    enabled: activeTab === 'config',
  });

  const transactions: EditTransaction[] = transactionsData || [];
  const vans: EditVanProvider[] = vansData || [];
  const partners: EditTradingPartner[] = partnersData || [];
  const txTypes: EditTransactionType[] = txTypesData || [];
  const formatSpecs: EditFormatSpec[] = formatSpecsData || [];
  const wfProviders: EditWorkflowProviderConfig[] = wfProvidersData || [];
  const errors: EditErrorLog[] = recentErrors || [];

  const serviceConnected = !!healthData;

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    let result = transactions;
    if (txStatusFilter) result = result.filter((t) => t.Status === txStatusFilter);
    if (txPartnerFilter) result = result.filter((t) => t.PartnerCode === txPartnerFilter);
    if (txTypeFilter) result = result.filter((t) => t.TypeCode === txTypeFilter);
    return result;
  }, [transactions, txStatusFilter, txPartnerFilter, txTypeFilter]);

  // Filtered errors
  const filteredErrors = useMemo(() => {
    let result = errors;
    if (errorSeverityFilter) result = result.filter((e) => e.Severity === errorSeverityFilter);
    if (errorResolvedFilter === 'resolved') result = result.filter((e) => e.IsResolved);
    if (errorResolvedFilter === 'unresolved') result = result.filter((e) => !e.IsResolved);
    return result;
  }, [errors, errorSeverityFilter, errorResolvedFilter]);

  // ===== Mutations =====

  const invalidateEdit = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'edit'] });
  };

  const saveVanMutation = useMutation({
    mutationFn: (data: { id?: string; payload: Record<string, unknown> }) =>
      data.id ? updateEditVanProvider(data.id, data.payload) : createEditVanProvider(data.payload),
    onSuccess: () => { invalidateEdit(); vanModal.close(); toast.success(isEditingVan ? 'VAN updated' : 'VAN created'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteVanMutation = useMutation({
    mutationFn: (id: string) => deleteEditVanProvider(id),
    onSuccess: () => { invalidateEdit(); deleteVanModal.close(); toast.success('VAN deleted'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const savePartnerMutation = useMutation({
    mutationFn: (data: { id?: string; payload: Record<string, unknown> }) =>
      data.id ? updateEditTradingPartner(data.id, data.payload) : createEditTradingPartner(data.payload),
    onSuccess: () => { invalidateEdit(); partnerModal.close(); toast.success(isEditingPartner ? 'Partner updated' : 'Partner created'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deletePartnerMutation = useMutation({
    mutationFn: (id: string) => deleteEditTradingPartner(id),
    onSuccess: () => { invalidateEdit(); deletePartnerModal.close(); toast.success('Partner deleted'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const retryTxMutation = useMutation({
    mutationFn: (id: number) => retryEditTransaction(id),
    onSuccess: () => { invalidateEdit(); toast.success('Transaction retry started'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const reprocessTxMutation = useMutation({
    mutationFn: (id: number) => reprocessEditTransaction(id),
    onSuccess: () => { invalidateEdit(); toast.success('Transaction reprocessing started'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const importSpecMutation = useMutation({
    mutationFn: (data: { fileName: string; fileContent: string; partnerCode?: string; typeCode?: string }) =>
      importEditFormatSpec(data),
    onSuccess: () => { invalidateEdit(); importModal.close(); setImportForm(INITIAL_IMPORT_FORM); toast.success('Format spec imported'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const autoMapMutation = useMutation({
    mutationFn: (specId: string) => autoMapEditFormatSpec(specId),
    onSuccess: () => { invalidateEdit(); toast.success('Auto-mapping completed'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const generateMapsMutation = useMutation({
    mutationFn: (specId: string) => generateEditFieldMaps(specId),
    onSuccess: () => { invalidateEdit(); toast.success('Field maps generated'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteSpecMutation = useMutation({
    mutationFn: (specId: string) => deleteEditFormatSpec(specId),
    onSuccess: () => { invalidateEdit(); toast.success('Format spec deleted'); },
    onError: (err: Error) => toast.error(err.message),
  });

  // ===== Handlers =====

  function openCreateVan() {
    setVanForm(INITIAL_VAN_FORM);
    setIsEditingVan(false);
    setEditingVanId(null);
    vanModal.open();
  }

  function openEditVan(van: EditVanProvider) {
    setVanForm({
      vanCode: van.VanCode, vanName: van.VanName, vanType: van.VanType,
      documentFormat: van.DocumentFormat, pollEnabled: van.PollEnabled,
      pollIntervalMinutes: van.PollIntervalMinutes, isActive: van.IsActive,
    });
    setIsEditingVan(true);
    setEditingVanId(van.VanId);
    vanModal.open(van);
  }

  function handleSaveVan() {
    if (!vanForm.vanCode.trim()) { toast.error('VAN code is required'); return; }
    if (!vanForm.vanName.trim()) { toast.error('VAN name is required'); return; }
    saveVanMutation.mutate({
      id: editingVanId || undefined,
      payload: { ...vanForm },
    });
  }

  function openCreatePartner() {
    setPartnerForm(INITIAL_PARTNER_FORM);
    setIsEditingPartner(false);
    setEditingPartnerId(null);
    partnerModal.open();
  }

  function openEditPartner(partner: EditTradingPartner) {
    setPartnerForm({
      partnerCode: partner.PartnerCode, companyName: partner.CompanyName,
      vanId: partner.VanId || '', defaultFormat: partner.DefaultFormat,
      workflowProvider: partner.WorkflowProvider || '', contactEmail: partner.ContactEmail || '',
      contactPhone: partner.ContactPhone || '', notes: partner.Notes || '', isActive: partner.IsActive,
    });
    setIsEditingPartner(true);
    setEditingPartnerId(partner.PartnerId);
    partnerModal.open(partner);
  }

  function handleSavePartner() {
    if (!partnerForm.partnerCode.trim()) { toast.error('Partner code is required'); return; }
    if (!partnerForm.companyName.trim()) { toast.error('Company name is required'); return; }
    savePartnerMutation.mutate({
      id: editingPartnerId || undefined,
      payload: { ...partnerForm, vanId: partnerForm.vanId || null, workflowProvider: partnerForm.workflowProvider || null },
    });
  }

  async function openTxDetail(tx: EditTransaction) {
    try {
      const stages = await getEditTransactionFlow(tx.TransactionId);
      setTxFlow(Array.isArray(stages) ? stages : []);
      txDetailModal.open(tx);
    } catch {
      toast.error('Failed to load transaction flow');
    }
  }

  async function handleTestVan(van: EditVanProvider) {
    setTestingVanId(van.VanId);
    try {
      const result = await testEditVanProvider(van.VanId);
      if (result?.ok || result?.success) {
        toast.success(result.message || 'Connection successful');
      } else {
        toast.error(result?.message || 'Connection failed');
      }
      invalidateEdit();
    } catch {
      toast.error('Connection test failed');
    } finally {
      setTestingVanId(null);
    }
  }

  async function handlePollVan(van: EditVanProvider) {
    setPollingVanId(van.VanId);
    try {
      await pollEditVanProvider(van.VanId);
      toast.success('Poll triggered');
      invalidateEdit();
    } catch {
      toast.error('Poll failed');
    } finally {
      setPollingVanId(null);
    }
  }

  async function handleTestWfProvider(provider: EditWorkflowProviderConfig) {
    setTestingWfpId(provider.ProviderId);
    try {
      const result = await testEditWorkflowProvider(provider.ProviderId);
      if (result?.ok || result?.success) {
        toast.success('Provider connection OK');
      } else {
        toast.error(result?.message || 'Connection failed');
      }
      invalidateEdit();
    } catch {
      toast.error('Provider test failed');
    } finally {
      setTestingWfpId(null);
    }
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1] || '';
      setImportForm((prev) => ({ ...prev, fileName: file.name, fileContent: base64 }));
    };
    reader.readAsDataURL(file);
  }

  function handleImportSpec() {
    if (!importForm.fileName || !importForm.fileContent) { toast.error('Select a file first'); return; }
    importSpecMutation.mutate({
      fileName: importForm.fileName,
      fileContent: importForm.fileContent,
      partnerCode: importForm.partnerCode || undefined,
      typeCode: importForm.typeCode || undefined,
    });
  }

  async function openSpecFields(spec: EditFormatSpec) {
    try {
      const fields = await getEditFormatSpecFields(spec.SpecId);
      setSpecFields(Array.isArray(fields) ? fields : []);
      fieldsModal.open(spec);
    } catch {
      toast.error('Failed to load spec fields');
    }
  }

  function toggleExpandPartner(id: string) {
    setExpandedPartners((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ===== Column definitions =====

  const txColumns: ColumnDef<EditTransaction>[] = [
    { key: 'TransactionId', label: 'ID', width: 70, sortable: true, render: (val) => <code className="text-xs text-semantic-text-faint">{val}</code> },
    { key: 'PartnerCode', label: 'Partner', sortable: true, render: (val, row) => <span className="text-semantic-text-secondary">{row.CompanyName || val}</span> },
    { key: 'TypeCode', label: 'Type', width: 100, sortable: true, render: (val, row) => <span className="text-xs" title={row.TypeName || undefined}>{val}</span> },
    { key: 'Direction', label: 'Dir', width: 70, sortable: true, render: (val) => <span className={`text-xs font-medium ${val === 'INBOUND' ? 'text-blue-400' : 'text-amber-400'}`}>{val === 'INBOUND' ? 'IN' : 'OUT'}</span> },
    { key: 'DocumentRef', label: 'Document Ref', width: 140, render: (val) => val ? <code className="text-xs">{val}</code> : <span className="text-semantic-text-faint">-</span> },
    {
      key: 'Status', label: 'Status', width: 110, sortable: true,
      render: (val) => <StatusBadge status={TX_STATUS_MAP[val] || 'neutral'} label={val} size="sm" />,
    },
    { key: 'ReceivedAt', label: 'Received', width: 160, sortable: true, render: (val) => <span className="text-xs text-semantic-text-faint">{val ? new Date(val).toLocaleString() : '-'}</span> },
    { key: 'DurationMs', label: 'Duration', width: 90, sortable: true, render: (val) => <span className="text-semantic-text-faint">{val ? (val / 1000).toFixed(2) + 's' : '-'}</span> },
    {
      key: 'TransactionId' as any, label: 'Actions', width: 110, sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openTxDetail(row)} className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover" title="View Flow"><Eye className="w-4 h-4" /></button>
          {row.Status === 'FAILED' && (
            <>
              <button type="button" onClick={() => retryTxMutation.mutate(row.TransactionId)} className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover" title="Retry"><RotateCcw className="w-4 h-4" /></button>
              <button type="button" onClick={() => reprocessTxMutation.mutate(row.TransactionId)} className="p-1.5 text-semantic-text-faint hover:text-warning rounded hover:bg-interactive-hover" title="Reprocess"><RefreshCw className="w-4 h-4" /></button>
            </>
          )}
        </div>
      ),
    },
  ];

  const vanColumns: ColumnDef<EditVanProvider>[] = [
    { key: 'VanCode', label: 'Code', width: 100, sortable: true, render: (val) => <code className="text-primary text-xs">{val}</code> },
    {
      key: 'VanName', label: 'Name', sortable: true, filterable: true,
      render: (val) => <span className="font-medium text-semantic-text-default">{val}</span>,
    },
    { key: 'VanType', label: 'Type', width: 90, sortable: true },
    { key: 'DocumentFormat', label: 'Format', width: 90, render: (val) => <span className="text-semantic-text-faint">{val}</span> },
    { key: 'PollEnabled', label: 'Polling', width: 90, render: (val) => <StatusBadge status={val ? 'success' : 'neutral'} label={val ? 'On' : 'Off'} size="sm" /> },
    {
      key: 'PollLastStatus', label: 'Last Poll', width: 100,
      render: (val) => {
        if (!val) return <span className="text-semantic-text-faint text-xs">Never</span>;
        const map: Record<string, 'success' | 'danger' | 'warning'> = { OK: 'success', FAILED: 'danger', WARNING: 'warning' };
        return <StatusBadge status={map[val] || 'neutral'} label={val} size="sm" />;
      },
    },
    { key: 'PollLastRun', label: 'Last Run', width: 160, render: (val) => <span className="text-xs text-semantic-text-faint">{val ? new Date(val).toLocaleString() : '-'}</span> },
    { key: 'IsActive', label: 'Status', width: 90, render: (val) => <StatusBadge status={val ? 'success' : 'neutral'} label={val ? 'Active' : 'Inactive'} size="sm" /> },
    {
      key: 'VanId', label: 'Actions', width: 130, sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => handleTestVan(row)}
            disabled={testingVanId === row.VanId}
            className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover disabled:opacity-50"
            title="Test Connection"
          >
            {testingVanId === row.VanId ? <RefreshCw className="w-4 h-4 animate-spin" /> : row.PollLastStatus === 'OK' ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          </button>
          {row.PollEnabled && (
            <button
              type="button"
              onClick={() => handlePollVan(row)}
              disabled={pollingVanId === row.VanId}
              className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover disabled:opacity-50"
              title="Trigger Poll"
            >
              {pollingVanId === row.VanId ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            </button>
          )}
          <button type="button" onClick={() => openEditVan(row)} className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover" title="Edit"><Edit className="w-4 h-4" /></button>
          <button type="button" onClick={() => deleteVanModal.open(row)} className="p-1.5 text-semantic-text-faint hover:text-danger rounded hover:bg-interactive-hover" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  const partnerColumns: ColumnDef<EditTradingPartner>[] = [
    {
      key: 'PartnerCode', label: 'Partner', sortable: true, filterable: true,
      render: (val, row) => (
        <div className="flex items-center gap-2">
          <button type="button" onClick={(e) => { e.stopPropagation(); toggleExpandPartner(row.PartnerId); }} className="p-0.5 text-semantic-text-faint hover:text-primary">
            {expandedPartners.has(row.PartnerId) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          <div>
            <code className="text-primary text-xs">{val}</code>
            <div className="text-sm font-medium text-semantic-text-default">{row.CompanyName}</div>
          </div>
        </div>
      ),
    },
    { key: 'VanName', label: 'VAN', width: 140, render: (val) => <span className="text-semantic-text-secondary">{val || '-'}</span> },
    { key: 'DefaultFormat', label: 'Format', width: 90, render: (val) => <span className="text-semantic-text-faint">{val}</span> },
    { key: 'WorkflowProvider', label: 'Workflow', width: 130, render: (val) => val ? <span className="text-semantic-text-secondary">{val}</span> : <span className="text-semantic-text-faint">-</span> },
    { key: 'IsActive', label: 'Status', width: 90, render: (val) => <StatusBadge status={val ? 'success' : 'neutral'} label={val ? 'Active' : 'Inactive'} size="sm" /> },
    {
      key: 'PartnerId', label: 'Actions', width: 100, sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openEditPartner(row)} className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover" title="Edit"><Edit className="w-4 h-4" /></button>
          <button type="button" onClick={() => deletePartnerModal.open(row)} className="p-1.5 text-semantic-text-faint hover:text-danger rounded hover:bg-interactive-hover" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  const formatSpecColumns: ColumnDef<EditFormatSpec>[] = [
    { key: 'SpecName', label: 'Name', sortable: true, filterable: true, render: (val) => <span className="font-medium text-semantic-text-default">{val}</span> },
    { key: 'PartnerCode', label: 'Partner', width: 100, render: (val) => val ? <code className="text-xs">{val}</code> : <span className="text-semantic-text-faint">-</span> },
    { key: 'TypeCode', label: 'Type', width: 80, render: (val) => val ? <code className="text-xs">{val}</code> : <span className="text-semantic-text-faint">-</span> },
    { key: 'ImportedFrom', label: 'Source', width: 140, render: (val) => val ? <span className="text-xs text-semantic-text-faint truncate block max-w-[130px]" title={val}>{val}</span> : <span className="text-semantic-text-faint">-</span> },
    { key: 'FieldCount', label: 'Fields', width: 70, sortable: true, render: (val) => <span className="text-semantic-text-faint">{val}</span> },
    {
      key: 'MappingStatus', label: 'Mapping', width: 110, sortable: true,
      render: (val) => <StatusBadge status={MAPPING_STATUS_MAP[val] || 'neutral'} label={val} size="sm" />,
    },
    { key: 'ImportedAt', label: 'Imported', width: 160, render: (val) => <span className="text-xs text-semantic-text-faint">{val ? new Date(val).toLocaleString() : '-'}</span> },
    {
      key: 'SpecId', label: 'Actions', width: 150, sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openSpecFields(row)} className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover" title="View Fields"><Eye className="w-4 h-4" /></button>
          <button type="button" onClick={() => autoMapMutation.mutate(row.SpecId)} disabled={autoMapMutation.isPending} className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover disabled:opacity-50" title="Auto Map"><Wand2 className="w-4 h-4" /></button>
          <button type="button" onClick={() => generateMapsMutation.mutate(row.SpecId)} disabled={generateMapsMutation.isPending} className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover disabled:opacity-50" title="Generate Maps"><FileSpreadsheet className="w-4 h-4" /></button>
          <button type="button" onClick={() => { if (window.confirm('Delete this format spec?')) deleteSpecMutation.mutate(row.SpecId); }} className="p-1.5 text-semantic-text-faint hover:text-danger rounded hover:bg-interactive-hover" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  const errorColumns: ColumnDef<EditErrorLog>[] = [
    { key: 'ErrorId', label: 'ID', width: 70, sortable: true, render: (val) => <code className="text-xs text-semantic-text-faint">{val}</code> },
    { key: 'StageName', label: 'Stage', width: 100, render: (val) => val ? <code className="text-xs">{val}</code> : <span className="text-semantic-text-faint">-</span> },
    {
      key: 'Severity', label: 'Severity', width: 100, sortable: true,
      render: (val) => <StatusBadge status={SEVERITY_MAP[val] || 'neutral'} label={val} size="sm" />,
    },
    { key: 'ErrorMessage', label: 'Message', render: (val) => <span className="text-xs text-semantic-text-default truncate block max-w-[400px]" title={val}>{val}</span> },
    { key: 'PartnerCode', label: 'Partner', width: 100, render: (val) => val ? <code className="text-xs">{val}</code> : <span className="text-semantic-text-faint">-</span> },
    { key: 'CreatedAt', label: 'Time', width: 160, sortable: true, render: (val) => <span className="text-xs text-semantic-text-faint">{val ? new Date(val).toLocaleString() : '-'}</span> },
    {
      key: 'IsResolved', label: 'Resolved', width: 100,
      render: (val) => val
        ? <span className="inline-flex items-center gap-1 text-xs text-success"><CheckCircle className="w-3.5 h-3.5" /> Yes</span>
        : <span className="inline-flex items-center gap-1 text-xs text-semantic-text-faint"><XCircle className="w-3.5 h-3.5" /> No</span>,
    },
  ];

  const txTypeColumns: ColumnDef<EditTransactionType>[] = [
    { key: 'TypeCode', label: 'Code', width: 100, sortable: true, render: (val) => <code className="text-primary text-xs">{val}</code> },
    { key: 'TypeName', label: 'Name', sortable: true, render: (val) => <span className="text-semantic-text-default">{val}</span> },
    { key: 'Direction', label: 'Direction', width: 100, render: (val) => <span className={`text-xs font-medium ${val === 'INBOUND' ? 'text-blue-400' : 'text-amber-400'}`}>{val}</span> },
    { key: 'Description', label: 'Description', render: (val) => <span className="text-xs text-semantic-text-faint">{val || '-'}</span> },
    { key: 'IsActive', label: 'Status', width: 90, render: (val) => <StatusBadge status={val ? 'success' : 'neutral'} label={val ? 'Active' : 'Inactive'} size="sm" /> },
  ];

  const wfProviderColumns: ColumnDef<EditWorkflowProviderConfig>[] = [
    { key: 'ProviderName', label: 'Name', sortable: true, render: (val) => <span className="font-medium text-semantic-text-default">{val}</span> },
    { key: 'ProviderType', label: 'Type', width: 120, render: (val) => <span className="text-semantic-text-faint">{val}</span> },
    { key: 'BaseUrl', label: 'URL', render: (val) => val ? <span className="text-xs text-semantic-text-faint truncate block max-w-[250px]" title={val}>{val}</span> : <span className="text-semantic-text-faint">-</span> },
    { key: 'IsActive', label: 'Status', width: 90, render: (val) => <StatusBadge status={val ? 'success' : 'neutral'} label={val ? 'Active' : 'Inactive'} size="sm" /> },
    {
      key: 'LastTestStatus', label: 'Health', width: 100,
      render: (val) => {
        if (!val) return <span className="text-semantic-text-faint text-xs">Not tested</span>;
        const map: Record<string, 'success' | 'danger'> = { OK: 'success', FAILED: 'danger' };
        return <StatusBadge status={map[val] || 'neutral'} label={val} size="sm" />;
      },
    },
    {
      key: 'ProviderId', label: 'Actions', width: 80, sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => handleTestWfProvider(row)}
            disabled={testingWfpId === row.ProviderId}
            className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover disabled:opacity-50"
            title="Test Connection"
          >
            {testingWfpId === row.ProviderId ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
          </button>
        </div>
      ),
    },
  ];

  const specFieldColumns: ColumnDef<EditFormatSpecField>[] = [
    { key: 'FieldPosition', label: '#', width: 50, sortable: true },
    { key: 'FieldName', label: 'Field', sortable: true, render: (val) => <code className="text-xs">{val}</code> },
    { key: 'DataType', label: 'Type', width: 80, render: (val) => <span className="text-semantic-text-faint">{val || '-'}</span> },
    { key: 'MaxLength', label: 'Max Len', width: 80, render: (val) => <span className="text-semantic-text-faint">{val ?? '-'}</span> },
    { key: 'IsRequired', label: 'Required', width: 80, render: (val) => val ? <span className="text-warning text-xs">Yes</span> : <span className="text-semantic-text-faint text-xs">No</span> },
    { key: 'MappedTo', label: 'Mapped To', render: (val) => val ? <code className="text-xs text-success">{val}</code> : <span className="text-semantic-text-faint">-</span> },
    {
      key: 'MappingStatus', label: 'Status', width: 100,
      render: (val) => <StatusBadge status={MAPPING_STATUS_MAP[val] || 'neutral'} label={val} size="sm" />,
    },
  ];

  // ===== Render =====

  return (
    <div className="space-y-6">
      <PageHeader
        title="EdIT - EDI Integration"
        description="Electronic Data Interchange transaction management, VAN providers, and trading partner configuration"
      />

      <PageStatusBar items={[
        { type: 'badge', label: 'Service', status: serviceConnected ? 'success' : 'danger', badgeLabel: serviceConnected ? 'Connected' : 'Offline' },
        { type: 'text', label: 'Transactions Today', value: dashboardSummary?.totalTransactionsToday || 0 },
        { type: 'text', label: 'Success Rate', value: dashboardSummary ? `${dashboardSummary.successRate.toFixed(1)}%` : '-' },
        { type: 'text', label: 'Active VANs', value: dashboardSummary?.activeVans || 0 },
        { type: 'text', label: 'Active Partners', value: dashboardSummary?.activePartners || 0 },
        { type: 'text', label: 'Errors', value: dashboardSummary?.recentErrors || 0, colorClass: (dashboardSummary?.recentErrors || 0) > 0 ? 'text-danger' : 'text-semantic-text-faint' },
      ]} />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab: Dashboard */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {dashboardSummary && (
            <div className="grid grid-cols-5 gap-3">
              <MiniStat label="Transactions Today" value={dashboardSummary.totalTransactionsToday} color="text-info" />
              <MiniStat label="Success Rate" value={`${dashboardSummary.successRate.toFixed(1)}%`} color="text-success" />
              <MiniStat label="Active VANs" value={dashboardSummary.activeVans} color="text-primary" />
              <MiniStat label="Active Partners" value={dashboardSummary.activePartners} color="text-primary" />
              <MiniStat label="Recent Errors" value={dashboardSummary.recentErrors} color="text-danger" />
            </div>
          )}

          {dashboardStats?.byStatus && dashboardStats.byStatus.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-semantic-text-subtle mb-3">Transactions by Status</h3>
              <div className="flex flex-wrap gap-3">
                {dashboardStats.byStatus.map((s) => (
                  <div key={s.Status} className="bg-surface-overlay rounded-lg px-3 py-2 text-center min-w-[80px]">
                    <div className="text-lg font-bold text-semantic-text-default">{s.Count}</div>
                    <div className="text-[10px] text-semantic-text-faint">{s.Status}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <TableCard
            title="Recent Transactions"
            icon={<ArrowRightLeft className="w-4 h-4" />}
            count={transactions.length}
          >
            <DataTable<EditTransaction>
              id="admin-edit-recent-tx"
              columns={txColumns}
              data={transactions.slice(0, 10)}
              rowKey="TransactionId"
              onRowClick={openTxDetail}
              emptyMessage="No recent transactions"
              emptyIcon={ArrowRightLeft}
              embedded
              showFilters={false}
              showColumnPicker={false}
            />
          </TableCard>
        </div>
      )}

      {/* Tab: Transactions */}
      {activeTab === 'transactions' && (
        <TableCard
          title="Transactions"
          icon={<Clock className="w-4 h-4" />}
          count={filteredTransactions.length}
          headerActions={
            <div className="flex items-center gap-2">
              <select value={txStatusFilter} onChange={(e) => setTxStatusFilter(e.target.value)} className="form-input text-xs py-1 px-2 w-[120px]" title="Filter by status">
                <option value="">All Status</option>
                <option value="COMPLETED">Completed</option>
                <option value="FAILED">Failed</option>
                <option value="POSTING">Posting</option>
                <option value="PENDING">Pending</option>
              </select>
              <select value={txPartnerFilter} onChange={(e) => setTxPartnerFilter(e.target.value)} className="form-input text-xs py-1 px-2 w-[120px]" title="Filter by partner">
                <option value="">All Partners</option>
                {partners.map((p) => <option key={p.PartnerCode} value={p.PartnerCode}>{p.PartnerCode}</option>)}
              </select>
              <select value={txTypeFilter} onChange={(e) => setTxTypeFilter(e.target.value)} className="form-input text-xs py-1 px-2 w-[120px]" title="Filter by type">
                <option value="">All Types</option>
                {txTypes.map((t) => <option key={t.TypeCode} value={t.TypeCode}>{t.TypeCode}</option>)}
              </select>
            </div>
          }
        >
          {txLoading ? <LoadingSpinner size="lg" /> : (
            <DataTable<EditTransaction>
              id="admin-edit-transactions"
              columns={txColumns}
              data={filteredTransactions}
              rowKey="TransactionId"
              onRowClick={openTxDetail}
              emptyMessage="No transactions found"
              emptyIcon={Clock}
              embedded
              pageSize={25}
              pageSizeOptions={[10, 25, 50, 100]}
              showFilters={false}
              showColumnPicker={false}
            />
          )}
        </TableCard>
      )}

      {/* Tab: VAN Providers */}
      {activeTab === 'vans' && (
        <TableCard
          title="VAN Providers"
          icon={<Network className="w-4 h-4" />}
          count={vans.length}
          headerActions={
            <Button icon={<Plus className="w-4 h-4" />} onClick={openCreateVan}>New VAN</Button>
          }
        >
          {vansLoading ? <LoadingSpinner size="lg" /> : (
            <DataTable<EditVanProvider>
              id="admin-edit-vans"
              columns={vanColumns}
              data={vans}
              rowKey="VanId"
              onRowClick={openEditVan}
              emptyMessage="No VAN providers configured"
              emptyIcon={Network}
              showFilters
              embedded
              showColumnPicker={false}
            />
          )}
        </TableCard>
      )}

      {/* Tab: Trading Partners */}
      {activeTab === 'partners' && (
        <TableCard
          title="Trading Partners"
          icon={<Users className="w-4 h-4" />}
          count={partners.length}
          headerActions={
            <Button icon={<Plus className="w-4 h-4" />} onClick={openCreatePartner}>New Partner</Button>
          }
        >
          {partnersLoading ? <LoadingSpinner size="lg" /> : (
            <DataTable<EditTradingPartner>
              id="admin-edit-partners"
              columns={partnerColumns}
              data={partners}
              rowKey="PartnerId"
              onRowClick={openEditPartner}
              emptyMessage="No trading partners configured"
              emptyIcon={Users}
              showFilters
              embedded
              showColumnPicker={false}
            />
          )}
        </TableCard>
      )}

      {/* Tab: Format Specs */}
      {activeTab === 'formats' && (
        <TableCard
          title="Format Specifications"
          icon={<FileSpreadsheet className="w-4 h-4" />}
          count={formatSpecs.length}
          headerActions={
            <Button icon={<Upload className="w-4 h-4" />} onClick={() => importModal.open()}>Import Spec</Button>
          }
        >
          {specsLoading ? <LoadingSpinner size="lg" /> : (
            <DataTable<EditFormatSpec>
              id="admin-edit-format-specs"
              columns={formatSpecColumns}
              data={formatSpecs}
              rowKey="SpecId"
              onRowClick={openSpecFields}
              emptyMessage="No format specifications imported"
              emptyIcon={FileSpreadsheet}
              showFilters
              embedded
              showColumnPicker={false}
            />
          )}
        </TableCard>
      )}

      {/* Tab: Configuration */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          <TableCard
            title="Transaction Types"
            icon={<Settings className="w-4 h-4" />}
            count={txTypes.length}
          >
            <DataTable<EditTransactionType>
              id="admin-edit-tx-types"
              columns={txTypeColumns}
              data={txTypes}
              rowKey="TypeCode"
              emptyMessage="No transaction types configured"
              emptyIcon={Settings}
              embedded
              showFilters={false}
              showColumnPicker={false}
            />
          </TableCard>

          <TableCard
            title="Workflow Providers"
            icon={<Network className="w-4 h-4" />}
            count={wfProviders.length}
          >
            {wfpLoading ? <LoadingSpinner size="lg" /> : (
              <DataTable<EditWorkflowProviderConfig>
                id="admin-edit-wf-providers"
                columns={wfProviderColumns}
                data={wfProviders}
                rowKey="ProviderId"
                emptyMessage="No workflow providers configured"
                emptyIcon={Network}
                embedded
                showFilters={false}
                showColumnPicker={false}
              />
            )}
          </TableCard>
        </div>
      )}

      {/* Tab: Error Log */}
      {activeTab === 'errors' && (
        <TableCard
          title="Error Log"
          icon={<AlertTriangle className="w-4 h-4" />}
          count={filteredErrors.length}
          headerActions={
            <div className="flex items-center gap-2">
              <select value={errorSeverityFilter} onChange={(e) => setErrorSeverityFilter(e.target.value)} className="form-input text-xs py-1 px-2 w-[120px]" title="Filter by severity">
                <option value="">All Severity</option>
                <option value="CRITICAL">Critical</option>
                <option value="ERROR">Error</option>
                <option value="WARNING">Warning</option>
              </select>
              <select value={errorResolvedFilter} onChange={(e) => setErrorResolvedFilter(e.target.value)} className="form-input text-xs py-1 px-2 w-[120px]" title="Filter by resolved">
                <option value="">All</option>
                <option value="unresolved">Unresolved</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          }
        >
          <DataTable<EditErrorLog>
            id="admin-edit-errors"
            columns={errorColumns}
            data={filteredErrors}
            rowKey="ErrorId"
            emptyMessage="No errors found"
            emptyIcon={AlertTriangle}
            embedded
            pageSize={25}
            pageSizeOptions={[10, 25, 50]}
            showFilters={false}
            showColumnPicker={false}
          />
        </TableCard>
      )}

      {/* Transaction Detail / Flow Modal */}
      <Modal isOpen={txDetailModal.isOpen} onClose={txDetailModal.close} title={`Transaction #${txDetailModal.data?.TransactionId || ''}`} size="lg">
        {txDetailModal.data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <DetailItem label="Partner" value={txDetailModal.data.CompanyName || txDetailModal.data.PartnerCode} />
              <DetailItem label="Status" value={txDetailModal.data.Status} />
              <DetailItem label="Type" value={txDetailModal.data.TypeName || txDetailModal.data.TypeCode} />
              <DetailItem label="Direction" value={txDetailModal.data.Direction} />
              <DetailItem label="Document Ref" value={txDetailModal.data.DocumentRef || '-'} />
              <DetailItem label="Duration" value={txDetailModal.data.DurationMs ? (txDetailModal.data.DurationMs / 1000).toFixed(2) + 's' : '-'} />
              <DetailItem label="Received" value={txDetailModal.data.ReceivedAt ? new Date(txDetailModal.data.ReceivedAt).toLocaleString() : '-'} />
              <DetailItem label="Completed" value={txDetailModal.data.CompletedAt ? new Date(txDetailModal.data.CompletedAt).toLocaleString() : '-'} />
            </div>
            {txDetailModal.data.ErrorMessage && (
              <div>
                <label className="block text-xs font-medium text-danger mb-1">Error</label>
                <pre className="bg-surface-overlay rounded-lg p-3 text-xs text-danger font-mono overflow-auto max-h-[100px]">{txDetailModal.data.ErrorMessage}</pre>
              </div>
            )}
            {txFlow.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-semantic-text-subtle mb-1">Pipeline Flow</label>
                <div className="bg-surface-overlay rounded-lg p-3">
                  <PipelineFlow stages={txFlow} />
                </div>
              </div>
            )}
            {txDetailModal.data.Status === 'FAILED' && (
              <div className="flex items-center gap-2 pt-2">
                <Button size="sm" icon={<RotateCcw className="w-4 h-4" />} onClick={() => { retryTxMutation.mutate(txDetailModal.data!.TransactionId); txDetailModal.close(); }}>
                  Retry
                </Button>
                <Button size="sm" variant="secondary" icon={<RefreshCw className="w-4 h-4" />} onClick={() => { reprocessTxMutation.mutate(txDetailModal.data!.TransactionId); txDetailModal.close(); }}>
                  Reprocess
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* VAN Create/Edit Modal */}
      <Modal
        isOpen={vanModal.isOpen}
        onClose={vanModal.close}
        title={isEditingVan ? 'Edit VAN Provider' : 'New VAN Provider'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={vanModal.close}>Cancel</Button>
            <Button onClick={handleSaveVan} loading={saveVanMutation.isPending}>{isEditingVan ? 'Save Changes' : 'Create'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="VAN Code" required>
              <input type="text" value={vanForm.vanCode} onChange={(e) => setVanForm({ ...vanForm, vanCode: e.target.value })} className="form-input" placeholder="e.g. SPS_COMMERCE" disabled={isEditingVan} />
            </FormField>
            <FormField label="VAN Name" required>
              <input type="text" value={vanForm.vanName} onChange={(e) => setVanForm({ ...vanForm, vanName: e.target.value })} className="form-input" placeholder="SPS Commerce" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="VAN Type">
              <select value={vanForm.vanType} onChange={(e) => setVanForm({ ...vanForm, vanType: e.target.value })} className="form-input" title="VAN type">
                <option value="AS2">AS2</option>
                <option value="SFTP">SFTP</option>
                <option value="API">API</option>
                <option value="VAN">VAN</option>
              </select>
            </FormField>
            <FormField label="Document Format">
              <select value={vanForm.documentFormat} onChange={(e) => setVanForm({ ...vanForm, documentFormat: e.target.value })} className="form-input" title="Document format">
                <option value="X12">X12</option>
                <option value="EDIFACT">EDIFACT</option>
                <option value="XML">XML</option>
                <option value="CSV">CSV</option>
                <option value="JSON">JSON</option>
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Polling">
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input type="checkbox" checked={vanForm.pollEnabled} onChange={(e) => setVanForm({ ...vanForm, pollEnabled: e.target.checked })} className="rounded border-border bg-surface-subtle text-primary focus:ring-interactive-focus-ring" />
                <span className="text-sm text-semantic-text-secondary">Enabled</span>
              </label>
            </FormField>
            <FormField label="Poll Interval (min)">
              <input type="number" value={vanForm.pollIntervalMinutes} onChange={(e) => setVanForm({ ...vanForm, pollIntervalMinutes: parseInt(e.target.value) || 15 })} className="form-input" min={1} disabled={!vanForm.pollEnabled} />
            </FormField>
            <FormField label="Status">
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input type="checkbox" checked={vanForm.isActive} onChange={(e) => setVanForm({ ...vanForm, isActive: e.target.checked })} className="rounded border-border bg-surface-subtle text-primary focus:ring-interactive-focus-ring" />
                <span className="text-sm text-semantic-text-secondary">Active</span>
              </label>
            </FormField>
          </div>
        </div>
      </Modal>

      {/* Delete VAN Modal */}
      <Modal isOpen={deleteVanModal.isOpen} onClose={deleteVanModal.close} title="Delete VAN Provider" size="sm"
        footer={<><Button variant="secondary" onClick={deleteVanModal.close}>Cancel</Button><Button variant="danger" onClick={() => deleteVanModal.data && deleteVanMutation.mutate(deleteVanModal.data.VanId)} loading={deleteVanMutation.isPending}>Delete</Button></>}
      >
        <p className="text-sm text-semantic-text-subtle">Delete <strong className="text-semantic-text-default">{deleteVanModal.data?.VanName}</strong>? This cannot be undone.</p>
      </Modal>

      {/* Partner Create/Edit Modal */}
      <Modal
        isOpen={partnerModal.isOpen}
        onClose={partnerModal.close}
        title={isEditingPartner ? 'Edit Trading Partner' : 'New Trading Partner'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={partnerModal.close}>Cancel</Button>
            <Button onClick={handleSavePartner} loading={savePartnerMutation.isPending}>{isEditingPartner ? 'Save Changes' : 'Create'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Partner Code" required>
              <input type="text" value={partnerForm.partnerCode} onChange={(e) => setPartnerForm({ ...partnerForm, partnerCode: e.target.value })} className="form-input" placeholder="e.g. ACME_CORP" disabled={isEditingPartner} />
            </FormField>
            <FormField label="Company Name" required>
              <input type="text" value={partnerForm.companyName} onChange={(e) => setPartnerForm({ ...partnerForm, companyName: e.target.value })} className="form-input" placeholder="Acme Corporation" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="VAN Provider">
              <select value={partnerForm.vanId} onChange={(e) => setPartnerForm({ ...partnerForm, vanId: e.target.value })} className="form-input" title="VAN provider">
                <option value="">-- None --</option>
                {vans.filter((v) => v.IsActive).map((v) => <option key={v.VanId} value={v.VanId}>{v.VanName}</option>)}
              </select>
            </FormField>
            <FormField label="Default Format">
              <select value={partnerForm.defaultFormat} onChange={(e) => setPartnerForm({ ...partnerForm, defaultFormat: e.target.value })} className="form-input" title="Default format">
                <option value="X12">X12</option>
                <option value="EDIFACT">EDIFACT</option>
                <option value="XML">XML</option>
                <option value="CSV">CSV</option>
                <option value="JSON">JSON</option>
              </select>
            </FormField>
          </div>
          <FormField label="Workflow Provider">
            <input type="text" value={partnerForm.workflowProvider} onChange={(e) => setPartnerForm({ ...partnerForm, workflowProvider: e.target.value })} className="form-input" placeholder="Optional workflow provider name" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Contact Email">
              <input type="email" value={partnerForm.contactEmail} onChange={(e) => setPartnerForm({ ...partnerForm, contactEmail: e.target.value })} className="form-input" placeholder="edi@partner.com" />
            </FormField>
            <FormField label="Contact Phone">
              <input type="text" value={partnerForm.contactPhone} onChange={(e) => setPartnerForm({ ...partnerForm, contactPhone: e.target.value })} className="form-input" placeholder="+1 555-0100" />
            </FormField>
          </div>
          <FormField label="Notes">
            <textarea value={partnerForm.notes} onChange={(e) => setPartnerForm({ ...partnerForm, notes: e.target.value })} className="form-input" rows={2} placeholder="Optional notes" />
          </FormField>
          <FormField label="Status">
            <label className="flex items-center gap-2 mt-1 cursor-pointer">
              <input type="checkbox" checked={partnerForm.isActive} onChange={(e) => setPartnerForm({ ...partnerForm, isActive: e.target.checked })} className="rounded border-border bg-surface-subtle text-primary focus:ring-interactive-focus-ring" />
              <span className="text-sm text-semantic-text-secondary">Active</span>
            </label>
          </FormField>
        </div>
      </Modal>

      {/* Delete Partner Modal */}
      <Modal isOpen={deletePartnerModal.isOpen} onClose={deletePartnerModal.close} title="Delete Trading Partner" size="sm"
        footer={<><Button variant="secondary" onClick={deletePartnerModal.close}>Cancel</Button><Button variant="danger" onClick={() => deletePartnerModal.data && deletePartnerMutation.mutate(deletePartnerModal.data.PartnerId)} loading={deletePartnerMutation.isPending}>Delete</Button></>}
      >
        <p className="text-sm text-semantic-text-subtle">Delete <strong className="text-semantic-text-default">{deletePartnerModal.data?.CompanyName}</strong>? This cannot be undone.</p>
      </Modal>

      {/* Import Format Spec Modal */}
      <Modal
        isOpen={importModal.isOpen}
        onClose={importModal.close}
        title="Import Format Specification"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={importModal.close}>Cancel</Button>
            <Button onClick={handleImportSpec} loading={importSpecMutation.isPending}>Import</Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="File (CSV/XLSX)" required>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleImportFile} className="form-input text-sm" />
            {importForm.fileName && <p className="text-xs text-semantic-text-faint mt-1">Selected: {importForm.fileName}</p>}
          </FormField>
          <FormField label="Partner Code">
            <select value={importForm.partnerCode} onChange={(e) => setImportForm({ ...importForm, partnerCode: e.target.value })} className="form-input" title="Partner code">
              <option value="">-- Optional --</option>
              {partners.map((p) => <option key={p.PartnerCode} value={p.PartnerCode}>{p.PartnerCode} - {p.CompanyName}</option>)}
            </select>
          </FormField>
          <FormField label="Transaction Type">
            <select value={importForm.typeCode} onChange={(e) => setImportForm({ ...importForm, typeCode: e.target.value })} className="form-input" title="Transaction type">
              <option value="">-- Optional --</option>
              {txTypes.map((t) => <option key={t.TypeCode} value={t.TypeCode}>{t.TypeCode} - {t.TypeName}</option>)}
            </select>
          </FormField>
        </div>
      </Modal>

      {/* Spec Fields Modal */}
      <Modal isOpen={fieldsModal.isOpen} onClose={fieldsModal.close} title={`Fields: ${fieldsModal.data?.SpecName || ''}`} size="xl">
        <DataTable<EditFormatSpecField>
          id="admin-edit-spec-fields"
          columns={specFieldColumns}
          data={specFields}
          rowKey="FieldId"
          emptyMessage="No fields found"
          emptyIcon={FileSpreadsheet}
          embedded
          pageSize={50}
          showFilters={false}
          showColumnPicker={false}
        />
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

function MiniStat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-surface-raised border border-border rounded-lg p-3 text-center">
      <div className={`text-xl font-bold ${(typeof value === 'number' ? value > 0 : value !== '-') ? color : 'text-semantic-text-faint'}`}>{value}</div>
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
