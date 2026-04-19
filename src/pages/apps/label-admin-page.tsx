import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tag, Plus, Edit, Trash2, Printer, FileText, History, Settings, Wifi, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DataTable,
  Button,
  Card,
  Modal,
  StatusBadge,
  Tabs,
  LoadingSpinner,
} from '@/components/shared';
import type { ColumnDef, TabItem } from '@/components/shared';
import {
  getLabelConfig,
  saveLabelConfig,
  testLabelConnection,
  getLabelPrinters,
  createLabelPrinter,
  updateLabelPrinter,
  deleteLabelPrinter,
  getLabelTemplates,
  createLabelTemplate,
  updateLabelTemplate,
  deleteLabelTemplate,
  getLabelHistory,
} from '@/services/admin-service';
import { useModal } from '@shared/hooks';
import type { LabelPrinter, LabelTemplate, LabelHistoryEntry } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const tabs: TabItem[] = [
  { id: 'printers', label: 'Printers', icon: <Printer className="w-4 h-4" /> },
  { id: 'templates', label: 'Templates', icon: <FileText className="w-4 h-4" /> },
  { id: 'history', label: 'Print History', icon: <History className="w-4 h-4" /> },
  { id: 'config', label: 'Configuration', icon: <Settings className="w-4 h-4" /> },
];

const PROVIDER_TYPES = ['BARTENDER', 'NICELABEL', 'QZ_TRAY'];
const AUTH_TYPES = ['NONE', 'BEARER', 'BASIC'];
const PRINTER_TYPES = ['ZEBRA', 'SATO', 'INTERMEC', 'DATAMAX', 'CAB', 'TSC', 'HONEYWELL', 'OTHER'];
const TEMPLATE_CONTEXTS = ['STOCK', 'SHIPPING', 'RECEIVING', 'BIN', 'PALLET', 'CONTAINER', 'GENERAL'];
const TEMPLATE_APPLICATIONS = ['StackIT', 'FloorIT', 'FlipIT', 'All'];

// ---------------------------------------------------------------------------
// Form types
// ---------------------------------------------------------------------------

interface PrinterForm {
  printerName: string;
  printerPath: string;
  printerType: string;
  location: string;
  workCentreCode: string;
  warehouse: string;
  isDefault: boolean;
}

const INITIAL_PRINTER_FORM: PrinterForm = {
  printerName: '', printerPath: '', printerType: 'ZEBRA', location: '',
  workCentreCode: '', warehouse: '', isDefault: false,
};

interface TemplateForm {
  templateName: string;
  templateFile: string;
  context: string;
  application: string;
  description: string;
  defaultPrinterId: string;
}

const INITIAL_TEMPLATE_FORM: TemplateForm = {
  templateName: '', templateFile: '', context: 'GENERAL', application: 'All',
  description: '', defaultPrinterId: '',
};

interface ConfigForm {
  providerType: string;
  baseUrl: string;
  authType: string;
  username: string;
  apiKey: string;
}

const INITIAL_CONFIG_FORM: ConfigForm = {
  providerType: '', baseUrl: '', authType: 'NONE', username: '', apiKey: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LabelAdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('printers');

  // Modals
  const printerModal = useModal<LabelPrinter>();
  const deletePrinterModal = useModal<LabelPrinter>();
  const templateModal = useModal<LabelTemplate>();
  const deleteTemplateModal = useModal<LabelTemplate>();

  // Forms
  const [printerForm, setPrinterForm] = useState<PrinterForm>(INITIAL_PRINTER_FORM);
  const [isEditingPrinter, setIsEditingPrinter] = useState(false);
  const [editingPrinterId, setEditingPrinterId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState<TemplateForm>(INITIAL_TEMPLATE_FORM);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [configForm, setConfigForm] = useState<ConfigForm>(INITIAL_CONFIG_FORM);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'failed'>('idle');

  // ---- Queries ----

  const { data: configData } = useQuery({
    queryKey: ['admin', 'labels', 'config'],
    queryFn: getLabelConfig,
    enabled: activeTab === 'config',
  });

  // Load config into form when data arrives
  if (configData && !configLoaded) {
    setConfigForm({
      providerType: configData.providerType || configData.ProviderType || '',
      baseUrl: configData.baseUrl || configData.BaseUrl || '',
      authType: configData.authType || 'NONE',
      username: configData.username || '',
      apiKey: configData.authType && configData.authType !== 'NONE' ? '********' : '',
    });
    setConfigLoaded(true);
  }

  const { data: printersData, isLoading: printersLoading } = useQuery({
    queryKey: ['admin', 'labels', 'printers'],
    queryFn: getLabelPrinters,
    enabled: activeTab === 'printers' || activeTab === 'templates',
  });

  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['admin', 'labels', 'templates'],
    queryFn: getLabelTemplates,
    enabled: activeTab === 'templates' || activeTab === 'history',
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['admin', 'labels', 'history'],
    queryFn: () => getLabelHistory({ limit: 50 }),
    enabled: activeTab === 'history',
  });

  // ---- Derived data ----

  const printers: LabelPrinter[] = printersData?.printers || [];
  const templates: LabelTemplate[] = templatesData?.templates || [];
  const history: LabelHistoryEntry[] = historyData?.history || [];

  // ---- Mutations: Config ----

  const saveConfigMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => saveLabelConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'labels', 'config'] });
      setConfigLoaded(false);
      toast.success('Configuration saved');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save configuration'),
  });

  // ---- Mutations: Printers ----

  const createPrinterMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => createLabelPrinter(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'labels', 'printers'] });
      printerModal.close();
      toast.success('Printer added');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to add printer'),
  });

  const updatePrinterMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updateLabelPrinter(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'labels', 'printers'] });
      printerModal.close();
      toast.success('Printer updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update printer'),
  });

  const deletePrinterMutation = useMutation({
    mutationFn: (id: string) => deleteLabelPrinter(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'labels', 'printers'] });
      deletePrinterModal.close();
      toast.success('Printer deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete printer'),
  });

  // ---- Mutations: Templates ----

  const createTemplateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => createLabelTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'labels', 'templates'] });
      templateModal.close();
      toast.success('Template added');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to add template'),
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updateLabelTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'labels', 'templates'] });
      templateModal.close();
      toast.success('Template updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update template'),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => deleteLabelTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'labels', 'templates'] });
      deleteTemplateModal.close();
      toast.success('Template deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete template'),
  });

  // ---- Handlers: Config ----

  function handleSaveConfig() {
    if (!configForm.providerType) { toast.error('Provider type is required'); return; }
    const data: Record<string, unknown> = {
      providerType: configForm.providerType,
      baseUrl: configForm.baseUrl,
      authType: configForm.authType,
      username: configForm.authType === 'BASIC' ? configForm.username : undefined,
      apiKey: configForm.apiKey !== '********' ? configForm.apiKey : undefined,
    };
    saveConfigMutation.mutate(data);
  }

  async function handleTestConnection() {
    setConnectionStatus('testing');
    try {
      const result = await testLabelConnection();
      if (result.success) {
        setConnectionStatus('connected');
        toast.success('Connection successful');
      } else {
        setConnectionStatus('failed');
        toast.error(result.error || 'Connection failed');
      }
    } catch {
      setConnectionStatus('failed');
      toast.error('Connection test failed');
    }
  }

  // ---- Handlers: Printers ----

  function openCreatePrinter() {
    setPrinterForm(INITIAL_PRINTER_FORM);
    setIsEditingPrinter(false);
    setEditingPrinterId(null);
    printerModal.open();
  }

  function openEditPrinter(p: LabelPrinter) {
    setPrinterForm({
      printerName: p.PrinterName,
      printerPath: p.PrinterPath || '',
      printerType: p.PrinterType || 'ZEBRA',
      location: p.Location || '',
      workCentreCode: p.WorkCentreCode || '',
      warehouse: p.Warehouse || '',
      isDefault: p.IsDefault,
    });
    setIsEditingPrinter(true);
    setEditingPrinterId(p.PrinterId);
    printerModal.open(p);
  }

  function handleSavePrinter() {
    if (!printerForm.printerName.trim()) { toast.error('Printer name is required'); return; }
    if (!printerForm.printerPath.trim()) { toast.error('Printer path is required'); return; }
    const data = { ...printerForm };
    if (isEditingPrinter && editingPrinterId) {
      updatePrinterMutation.mutate({ id: editingPrinterId, data });
    } else {
      createPrinterMutation.mutate(data);
    }
  }

  // ---- Handlers: Templates ----

  function openCreateTemplate() {
    setTemplateForm(INITIAL_TEMPLATE_FORM);
    setIsEditingTemplate(false);
    setEditingTemplateId(null);
    templateModal.open();
  }

  function openEditTemplate(t: LabelTemplate) {
    setTemplateForm({
      templateName: t.TemplateName,
      templateFile: t.TemplateFile,
      context: t.Context,
      application: t.Application,
      description: t.Description || '',
      defaultPrinterId: t.DefaultPrinterId || '',
    });
    setIsEditingTemplate(true);
    setEditingTemplateId(t.TemplateId);
    templateModal.open(t);
  }

  function handleSaveTemplate() {
    if (!templateForm.templateName.trim()) { toast.error('Template name is required'); return; }
    if (!templateForm.templateFile.trim()) { toast.error('Template file is required'); return; }
    const data = { ...templateForm, defaultPrinterId: templateForm.defaultPrinterId || null };
    if (isEditingTemplate && editingTemplateId) {
      updateTemplateMutation.mutate({ id: editingTemplateId, data });
    } else {
      createTemplateMutation.mutate(data);
    }
  }

  // ---- Column Definitions ----

  const printerColumns: ColumnDef<LabelPrinter>[] = [
    { key: 'PrinterName', label: 'Name', sortable: true, filterable: true, render: (val) => <span className="font-semibold text-dark-700">{val}</span> },
    { key: 'PrinterPath', label: 'Path', sortable: true, render: (val) => <code className="text-xs text-dark-400">{val || '-'}</code> },
    { key: 'PrinterType', label: 'Type', width: 100, sortable: true, filterable: true, filterType: 'select', filterOptions: PRINTER_TYPES.map(t => ({ value: t, label: t })), render: (val) => <span className="text-dark-500">{val || '-'}</span> },
    { key: 'Location', label: 'Location', width: 140, sortable: true, render: (val) => <span className="text-dark-400">{val || '-'}</span> },
    { key: 'IsDefault', label: 'Default', width: 80, render: (val) => val ? <StatusBadge status="success" label="Default" size="sm" /> : <span className="text-dark-400">-</span> },
    { key: 'IsActive', label: 'Status', width: 80, render: (val) => <StatusBadge status={val ? 'success' : 'neutral'} label={val ? 'Active' : 'Inactive'} size="sm" /> },
    {
      key: 'PrinterId', label: 'Actions', width: 100, sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openEditPrinter(row)} className="p-1.5 text-dark-400 hover:text-primary rounded hover:bg-dark-100 transition-colors" title="Edit"><Edit className="w-4 h-4" /></button>
          <button type="button" onClick={() => deletePrinterModal.open(row)} className="p-1.5 text-dark-400 hover:text-danger rounded hover:bg-dark-100 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  const templateColumns: ColumnDef<LabelTemplate>[] = [
    { key: 'TemplateName', label: 'Name', sortable: true, filterable: true, render: (val) => <span className="font-semibold text-dark-700">{val}</span> },
    { key: 'TemplateFile', label: 'File', sortable: true, render: (val) => <code className="text-xs text-dark-400">{val}</code> },
    { key: 'Context', label: 'Context', width: 110, sortable: true, filterable: true, filterType: 'select', filterOptions: TEMPLATE_CONTEXTS.map(c => ({ value: c, label: c })), render: (val) => <span className="text-dark-500">{val}</span> },
    { key: 'Application', label: 'App', width: 90, sortable: true, render: (val) => <span className="text-dark-400">{val}</span> },
    {
      key: 'DefaultPrinterId', label: 'Default Printer', width: 140,
      render: (val) => {
        const p = printers.find(pr => pr.PrinterId === val);
        return <span className="text-dark-400">{p ? p.PrinterName : '-'}</span>;
      },
    },
    { key: 'IsActive', label: 'Status', width: 80, render: (val) => <StatusBadge status={val ? 'success' : 'neutral'} label={val ? 'Active' : 'Inactive'} size="sm" /> },
    {
      key: 'TemplateId', label: 'Actions', width: 100, sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openEditTemplate(row)} className="p-1.5 text-dark-400 hover:text-primary rounded hover:bg-dark-100 transition-colors" title="Edit"><Edit className="w-4 h-4" /></button>
          <button type="button" onClick={() => deleteTemplateModal.open(row)} className="p-1.5 text-dark-400 hover:text-danger rounded hover:bg-dark-100 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  const historyColumns: ColumnDef<LabelHistoryEntry>[] = [
    { key: 'PrintedAt', label: 'Time', width: 170, sortable: true, render: (val) => <span className="text-dark-500">{val ? new Date(val).toLocaleString() : '-'}</span> },
    { key: 'TemplateId', label: 'Template', render: (val) => { const t = templates.find(tpl => tpl.TemplateId === val); return <span className="text-dark-600">{t ? t.TemplateName : '-'}</span>; } },
    { key: 'PrinterId', label: 'Printer', render: (val) => { const p = printers.find(pr => pr.PrinterId === val); return <span className="text-dark-400">{p ? p.PrinterName : '-'}</span>; } },
    { key: 'Copies', label: 'Copies', width: 70, render: (val) => <span className="text-dark-400">{val}</span> },
    { key: 'PrintedBy', label: 'Printed By', width: 120, render: (val) => <span className="text-dark-400">{val || '-'}</span> },
    { key: 'Application', label: 'App', width: 90, render: (val) => <span className="text-dark-400">{val || '-'}</span> },
    { key: 'Status', label: 'Status', width: 90, render: (val) => <StatusBadge status={val === 'PRINTED' || val === 'Success' ? 'success' : val === 'FAILED' || val === 'Failed' ? 'danger' : 'warning'} label={val} size="sm" /> },
  ];

  // ---- Render ----

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Tag className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold text-dark-700">LabelIT Admin</h1>
        </div>
        <div className="flex items-center gap-4 text-sm text-dark-400">
          <span><Printer className="w-3.5 h-3.5 inline mr-1" />{printers.length} printers</span>
          <span><FileText className="w-3.5 h-3.5 inline mr-1" />{templates.length} templates</span>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab: Printers */}
      {activeTab === 'printers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-dark-400">{printers.length} printers</span>
            <Button icon={<Plus className="w-4 h-4" />} onClick={openCreatePrinter}>Add Printer</Button>
          </div>
          {printersLoading ? <div className="flex justify-center py-8"><LoadingSpinner /></div> : (
            <DataTable<LabelPrinter>
              id="label-printers"
              columns={printerColumns}
              data={printers}
              rowKey="PrinterId"
              onRowClick={openEditPrinter}
              emptyMessage="No printers configured"
              emptyIcon={Printer}
              showFilters
            />
          )}
        </div>
      )}

      {/* Tab: Templates */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-dark-400">{templates.length} templates</span>
            <Button icon={<Plus className="w-4 h-4" />} onClick={openCreateTemplate}>Add Template</Button>
          </div>
          {templatesLoading ? <div className="flex justify-center py-8"><LoadingSpinner /></div> : (
            <DataTable<LabelTemplate>
              id="label-templates"
              columns={templateColumns}
              data={templates}
              rowKey="TemplateId"
              onRowClick={openEditTemplate}
              emptyMessage="No templates configured"
              emptyIcon={FileText}
              showFilters
            />
          )}
        </div>
      )}

      {/* Tab: History */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {historyLoading ? <div className="flex justify-center py-8"><LoadingSpinner /></div> : (
            <DataTable<LabelHistoryEntry>
              id="label-history"
              columns={historyColumns}
              data={history}
              rowKey="PrintedAt"
              emptyMessage="No print history found"
              emptyIcon={History}
            />
          )}
        </div>
      )}

      {/* Tab: Configuration */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          <Card title="Label Provider" headerAction={
            <div className="flex items-center gap-2">
              {connectionStatus === 'connected' && <Wifi className="w-4 h-4 text-success" />}
              {connectionStatus === 'failed' && <WifiOff className="w-4 h-4 text-danger" />}
              <Button variant="secondary" size="sm" onClick={handleTestConnection} loading={connectionStatus === 'testing'}>
                Test Connection
              </Button>
            </div>
          }>
            <div className="space-y-4">
              <FormField label="Provider Type" required>
                <select value={configForm.providerType} onChange={(e) => setConfigForm({ ...configForm, providerType: e.target.value })} className="form-input" title="Provider type">
                  <option value="">-- Select Provider --</option>
                  {PROVIDER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </FormField>
              <FormField label="Base URL">
                <input type="text" value={configForm.baseUrl} onChange={(e) => setConfigForm({ ...configForm, baseUrl: e.target.value })} className="form-input" placeholder="e.g., http://localhost:5159/api/v1" />
              </FormField>
              <FormField label="Authentication">
                <select value={configForm.authType} onChange={(e) => setConfigForm({ ...configForm, authType: e.target.value })} className="form-input" title="Auth type">
                  {AUTH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </FormField>
              {configForm.authType === 'BASIC' && (
                <FormField label="Username">
                  <input type="text" value={configForm.username} onChange={(e) => setConfigForm({ ...configForm, username: e.target.value })} className="form-input" placeholder="Username" />
                </FormField>
              )}
              {configForm.authType !== 'NONE' && (
                <FormField label={configForm.authType === 'BASIC' ? 'Password' : 'API Key / Bearer Token'}>
                  <input type="password" value={configForm.apiKey} onChange={(e) => setConfigForm({ ...configForm, apiKey: e.target.value })} className="form-input" placeholder="Enter key or token" />
                </FormField>
              )}
              <div className="flex justify-end">
                <Button onClick={handleSaveConfig} loading={saveConfigMutation.isPending}>Save Configuration</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Printer Modal */}
      <Modal
        isOpen={printerModal.isOpen}
        onClose={printerModal.close}
        title={isEditingPrinter ? 'Edit Printer' : 'Add Printer'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={printerModal.close}>Cancel</Button>
            <Button onClick={handleSavePrinter} loading={createPrinterMutation.isPending || updatePrinterMutation.isPending}>
              {isEditingPrinter ? 'Save Changes' : 'Add Printer'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Printer Name" required>
              <input type="text" value={printerForm.printerName} onChange={(e) => setPrinterForm({ ...printerForm, printerName: e.target.value })} className="form-input" placeholder="Warehouse Label Printer" />
            </FormField>
            <FormField label="Printer Type">
              <select value={printerForm.printerType} onChange={(e) => setPrinterForm({ ...printerForm, printerType: e.target.value })} className="form-input" title="Printer type">
                {PRINTER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Printer Path" required>
            <input type="text" value={printerForm.printerPath} onChange={(e) => setPrinterForm({ ...printerForm, printerPath: e.target.value })} className="form-input" placeholder="\\server\printername or IP:port" />
          </FormField>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Location">
              <input type="text" value={printerForm.location} onChange={(e) => setPrinterForm({ ...printerForm, location: e.target.value })} className="form-input" placeholder="Warehouse A" />
            </FormField>
            <FormField label="Work Centre">
              <input type="text" value={printerForm.workCentreCode} onChange={(e) => setPrinterForm({ ...printerForm, workCentreCode: e.target.value })} className="form-input" placeholder="WC01" />
            </FormField>
            <FormField label="Warehouse">
              <input type="text" value={printerForm.warehouse} onChange={(e) => setPrinterForm({ ...printerForm, warehouse: e.target.value })} className="form-input" placeholder="WH01" />
            </FormField>
          </div>
          <label className="flex items-center gap-2 text-sm text-dark-600 cursor-pointer">
            <input type="checkbox" checked={printerForm.isDefault} onChange={(e) => setPrinterForm({ ...printerForm, isDefault: e.target.checked })} className="rounded border-dark-300 bg-dark-200 text-primary focus:ring-primary/50" />
            Default printer
          </label>
        </div>
      </Modal>

      {/* Delete Printer Modal */}
      <Modal isOpen={deletePrinterModal.isOpen} onClose={deletePrinterModal.close} title="Delete Printer" size="sm" footer={
        <>
          <Button variant="secondary" onClick={deletePrinterModal.close}>Cancel</Button>
          <Button variant="danger" onClick={() => deletePrinterModal.data && deletePrinterMutation.mutate(deletePrinterModal.data.PrinterId)} loading={deletePrinterMutation.isPending}>Delete</Button>
        </>
      }>
        <p className="text-sm text-dark-500">Are you sure you want to delete <strong className="text-dark-700">{deletePrinterModal.data?.PrinterName}</strong>?</p>
      </Modal>

      {/* Template Modal */}
      <Modal
        isOpen={templateModal.isOpen}
        onClose={templateModal.close}
        title={isEditingTemplate ? 'Edit Template' : 'Add Template'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={templateModal.close}>Cancel</Button>
            <Button onClick={handleSaveTemplate} loading={createTemplateMutation.isPending || updateTemplateMutation.isPending}>
              {isEditingTemplate ? 'Save Changes' : 'Add Template'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Template Name" required>
            <input type="text" value={templateForm.templateName} onChange={(e) => setTemplateForm({ ...templateForm, templateName: e.target.value })} className="form-input" placeholder="Stock Label 4x2" />
          </FormField>
          <FormField label="Template File" required>
            <input type="text" value={templateForm.templateFile} onChange={(e) => setTemplateForm({ ...templateForm, templateFile: e.target.value })} className="form-input" placeholder="stock_label_4x2.btw" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Context" required>
              <select value={templateForm.context} onChange={(e) => setTemplateForm({ ...templateForm, context: e.target.value })} className="form-input" title="Context">
                {TEMPLATE_CONTEXTS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormField>
            <FormField label="Application">
              <select value={templateForm.application} onChange={(e) => setTemplateForm({ ...templateForm, application: e.target.value })} className="form-input" title="Application">
                {TEMPLATE_APPLICATIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Default Printer">
            <select value={templateForm.defaultPrinterId} onChange={(e) => setTemplateForm({ ...templateForm, defaultPrinterId: e.target.value })} className="form-input" title="Default printer">
              <option value="">-- No Default --</option>
              {printers.filter(p => p.IsActive).map(p => <option key={p.PrinterId} value={p.PrinterId}>{p.PrinterName}</option>)}
            </select>
          </FormField>
          <FormField label="Description">
            <textarea value={templateForm.description} onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })} className="form-input" rows={2} placeholder="Optional description" />
          </FormField>
        </div>
      </Modal>

      {/* Delete Template Modal */}
      <Modal isOpen={deleteTemplateModal.isOpen} onClose={deleteTemplateModal.close} title="Delete Template" size="sm" footer={
        <>
          <Button variant="secondary" onClick={deleteTemplateModal.close}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteTemplateModal.data && deleteTemplateMutation.mutate(deleteTemplateModal.data.TemplateId)} loading={deleteTemplateMutation.isPending}>Delete</Button>
        </>
      }>
        <p className="text-sm text-dark-500">Are you sure you want to delete <strong className="text-dark-700">{deleteTemplateModal.data?.TemplateName}</strong>?</p>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-dark-500 mb-1">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
