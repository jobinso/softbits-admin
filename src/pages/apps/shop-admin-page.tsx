import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingCart, Plus, Edit, Trash2, RefreshCw, Settings, Link2, BarChart3, Mail,
  Play, Square, Zap, Wifi, WifiOff, Copy,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DataTable,
  Button,
  Card,
  Modal,
  StatusBadge,
  Tabs,
  LoadingSpinner,
  PageHeader,
  PageStatusBar,
} from '@/components/shared';
import type { ColumnDef, TabItem, StatusBarItem } from '@/components/shared';
import {
  getShopStatus,
  getShopConfig,
  updateShopConfig,
  getShopConnections,
  createShopConnection,
  updateShopConnection,
  deleteShopConnection,
  testShopConnection,
  triggerShopSync,
  getShopQueue,
  getShopMarkitConnections,
  createShopMarkitConnection,
  updateShopMarkitConnection,
  deleteShopMarkitConnection,
  testShopMarkitConnection,
  getShopMarkitLists,
  syncShopMarkitList,
  getShopMarkitExports,
  getShopMarkitCampaigns,
  startShopSyncService,
  stopShopSyncService,
  triggerShopSyncNow,
} from '@/services/admin-service';
import { useModal } from '@shared/hooks';
import type {
  ShopStatus,
  ShopConnection,
  ShopConfig,
  ShopMarkitConnection,
  ShopMarkitList,
  ShopMarkitExport,
  ShopMarkitCampaign,
} from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const tabs: TabItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'ecommerce', label: 'E-commerce', icon: <ShoppingCart className="w-4 h-4" /> },
  { id: 'marketing', label: 'Marketing', icon: <Mail className="w-4 h-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
];

const PLATFORMS = [
  { value: '1', label: 'Shopify' },
  { value: '2', label: 'WooCommerce' },
  { value: '3', label: 'Magento' },
  { value: '4', label: 'BigCommerce' },
];

const MARKIT_PLATFORMS = ['brevo', 'mailchimp'];

// ---------------------------------------------------------------------------
// Form types
// ---------------------------------------------------------------------------

interface EcomConnectionForm {
  platformId: string;
  storeName: string;
  storeUrl: string;
  accessToken: string;
  syncEnabled: boolean;
  syncOrders: boolean;
  syncProducts: boolean;
  syncCustomers: boolean;
  syncInventory: boolean;
  defaultWarehouse: string;
  defaultBranch: string;
  defaultSalesRep: string;
  defaultTaxCode: string;
  isActive: boolean;
}

const INITIAL_ECOM_FORM: EcomConnectionForm = {
  platformId: '', storeName: '', storeUrl: '', accessToken: '',
  syncEnabled: true, syncOrders: true, syncProducts: true, syncCustomers: true, syncInventory: true,
  defaultWarehouse: '', defaultBranch: '', defaultSalesRep: '', defaultTaxCode: '', isActive: true,
};

interface MarkitConnectionForm {
  platformCode: string;
  name: string;
  apiKey: string;
  apiUrl: string;
  isActive: boolean;
}

const INITIAL_MARKIT_FORM: MarkitConnectionForm = {
  platformCode: 'brevo', name: '', apiKey: '', apiUrl: '', isActive: true,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ShopAdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Modals
  const ecomModal = useModal<ShopConnection>();
  const deleteEcomModal = useModal<ShopConnection>();
  const markitModal = useModal<ShopMarkitConnection>();
  const deleteMarkitModal = useModal<ShopMarkitConnection>();

  // Forms
  const [ecomForm, setEcomForm] = useState<EcomConnectionForm>(INITIAL_ECOM_FORM);
  const [isEditingEcom, setIsEditingEcom] = useState(false);
  const [editingEcomId, setEditingEcomId] = useState<string | null>(null);
  const [markitForm, setMarkitForm] = useState<MarkitConnectionForm>(INITIAL_MARKIT_FORM);
  const [isEditingMarkit, setIsEditingMarkit] = useState(false);
  const [editingMarkitId, setEditingMarkitId] = useState<string | null>(null);

  // ---- Queries ----

  const { data: statusData } = useQuery({
    queryKey: ['admin', 'shop', 'status'],
    queryFn: getShopStatus,
    refetchInterval: 15000,
  });

  const { data: connectionsData, isLoading: connectionsLoading } = useQuery({
    queryKey: ['admin', 'shop', 'connections'],
    queryFn: getShopConnections,
    enabled: activeTab === 'ecommerce' || activeTab === 'dashboard',
  });

  const { data: queueData } = useQuery({
    queryKey: ['admin', 'shop', 'queue'],
    queryFn: getShopQueue,
    enabled: activeTab === 'ecommerce' || activeTab === 'dashboard',
  });

  const { data: configData } = useQuery({
    queryKey: ['admin', 'shop', 'config'],
    queryFn: getShopConfig,
    enabled: activeTab === 'settings',
  });

  const { data: markitConnectionsData, isLoading: markitConnectionsLoading } = useQuery({
    queryKey: ['admin', 'shop', 'markit', 'connections'],
    queryFn: getShopMarkitConnections,
    enabled: activeTab === 'marketing',
  });

  const { data: markitListsData } = useQuery({
    queryKey: ['admin', 'shop', 'markit', 'lists'],
    queryFn: getShopMarkitLists,
    enabled: activeTab === 'marketing',
  });

  const { data: markitExportsData } = useQuery({
    queryKey: ['admin', 'shop', 'markit', 'exports'],
    queryFn: getShopMarkitExports,
    enabled: activeTab === 'marketing',
  });

  const { data: markitCampaignsData } = useQuery({
    queryKey: ['admin', 'shop', 'markit', 'campaigns'],
    queryFn: getShopMarkitCampaigns,
    enabled: activeTab === 'marketing',
  });

  // ---- Derived data ----

  const status: ShopStatus = statusData || {};
  const connections: ShopConnection[] = connectionsData?.connections || [];
  const queue = queueData?.queue || {};
  const config: ShopConfig = configData || {};
  const markitConnections: ShopMarkitConnection[] = markitConnectionsData?.connections || [];
  const markitLists: ShopMarkitList[] = markitListsData?.lists || [];
  const markitExports: ShopMarkitExport[] = markitExportsData?.exports || [];
  const markitCampaigns: ShopMarkitCampaign[] = markitCampaignsData?.campaigns || [];

  // ---- Mutations: E-commerce Connections ----

  const createEcomMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => createShopConnection(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'shop', 'connections'] });
      ecomModal.close();
      toast.success('Connection created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create connection'),
  });

  const updateEcomMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updateShopConnection(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'shop', 'connections'] });
      ecomModal.close();
      toast.success('Connection updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update connection'),
  });

  const deleteEcomMutation = useMutation({
    mutationFn: (id: string) => deleteShopConnection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'shop', 'connections'] });
      deleteEcomModal.close();
      toast.success('Connection deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete connection'),
  });

  const syncEcomMutation = useMutation({
    mutationFn: ({ id, type }: { id: string; type: string }) => triggerShopSync(id, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'shop'] });
      toast.success('Sync triggered');
    },
    onError: (err: Error) => toast.error(err.message || 'Sync failed'),
  });

  // ---- Mutations: Marketing Connections ----

  const createMarkitMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => createShopMarkitConnection(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'shop', 'markit'] });
      markitModal.close();
      toast.success('Marketing connection created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create connection'),
  });

  const updateMarkitMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updateShopMarkitConnection(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'shop', 'markit'] });
      markitModal.close();
      toast.success('Marketing connection updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update connection'),
  });

  const deleteMarkitMutation = useMutation({
    mutationFn: (id: string) => deleteShopMarkitConnection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'shop', 'markit'] });
      deleteMarkitModal.close();
      toast.success('Marketing connection deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete connection'),
  });

  const syncListMutation = useMutation({
    mutationFn: (listId: string) => syncShopMarkitList(listId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'shop', 'markit', 'lists'] });
      toast.success('List sync started');
    },
    onError: (err: Error) => toast.error(err.message || 'Sync failed'),
  });

  // ---- Mutations: Config ----

  const saveConfigMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => updateShopConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'shop', 'config'] });
      toast.success('Settings saved');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save settings'),
  });

  const startSyncMutation = useMutation({
    mutationFn: startShopSyncService,
    onSuccess: (data: Record<string, unknown>) => toast.success((data.message as string) || 'Sync service started'),
    onError: (err: Error) => toast.error(err.message || 'Failed to start sync'),
  });

  const stopSyncMutation = useMutation({
    mutationFn: stopShopSyncService,
    onSuccess: (data: Record<string, unknown>) => toast.success((data.message as string) || 'Sync service stopped'),
    onError: (err: Error) => toast.error(err.message || 'Failed to stop sync'),
  });

  const triggerSyncMutation = useMutation({
    mutationFn: triggerShopSyncNow,
    onSuccess: (data: Record<string, unknown>) => toast.success((data.message as string) || 'Sync cycle triggered'),
    onError: (err: Error) => toast.error(err.message || 'Failed to trigger sync'),
  });

  // ---- Handlers: E-commerce ----

  function openCreateEcom() {
    setEcomForm(INITIAL_ECOM_FORM);
    setIsEditingEcom(false);
    setEditingEcomId(null);
    ecomModal.open();
  }

  function openEditEcom(c: ShopConnection) {
    setEcomForm({
      platformId: c.PlatformId || '',
      storeName: c.StoreName || '',
      storeUrl: c.StoreUrl || '',
      accessToken: '',
      syncEnabled: c.SyncEnabled !== false,
      syncOrders: c.SyncOrders !== false,
      syncProducts: c.SyncProducts !== false,
      syncCustomers: c.SyncCustomers !== false,
      syncInventory: c.SyncInventory !== false,
      defaultWarehouse: c.DefaultWarehouse || '',
      defaultBranch: c.DefaultBranch || '',
      defaultSalesRep: c.DefaultSalesRep || '',
      defaultTaxCode: c.DefaultTaxCode || '',
      isActive: c.IsActive,
    });
    setIsEditingEcom(true);
    setEditingEcomId(c.ConnectionId);
    ecomModal.open(c);
  }

  function handleSaveEcom() {
    if (!isEditingEcom && (!ecomForm.platformId || !ecomForm.storeName)) {
      toast.error('Platform and store name are required');
      return;
    }
    const data: Record<string, unknown> = { ...ecomForm };
    if (!ecomForm.accessToken) delete data.accessToken;
    if (isEditingEcom && editingEcomId) {
      updateEcomMutation.mutate({ id: editingEcomId, data });
    } else {
      createEcomMutation.mutate(data);
    }
  }

  async function handleTestEcom(connectionId: string) {
    try {
      const result = await testShopConnection(connectionId);
      if (result.success) {
        toast.success(result.message || 'Connection successful');
      } else {
        toast.error(result.message || 'Connection failed');
      }
    } catch {
      toast.error('Connection test failed');
    }
  }

  // ---- Handlers: Marketing ----

  function openCreateMarkit() {
    setMarkitForm(INITIAL_MARKIT_FORM);
    setIsEditingMarkit(false);
    setEditingMarkitId(null);
    markitModal.open();
  }

  function openEditMarkit(c: ShopMarkitConnection) {
    setMarkitForm({
      platformCode: c.PlatformCode,
      name: c.Name,
      apiKey: '********',
      apiUrl: c.ApiUrl || '',
      isActive: c.IsActive,
    });
    setIsEditingMarkit(true);
    setEditingMarkitId(c.ConnectionId);
    markitModal.open(c);
  }

  function handleSaveMarkit() {
    if (!markitForm.name.trim()) { toast.error('Connection name is required'); return; }
    const data: Record<string, unknown> = {
      platformCode: markitForm.platformCode,
      name: markitForm.name,
      apiKey: markitForm.apiKey.startsWith('********') ? undefined : markitForm.apiKey,
      apiUrl: markitForm.platformCode === 'mailchimp' ? markitForm.apiUrl : undefined,
      isActive: markitForm.isActive,
    };
    if (isEditingMarkit && editingMarkitId) {
      updateMarkitMutation.mutate({ id: editingMarkitId, data });
    } else {
      createMarkitMutation.mutate(data);
    }
  }

  async function handleTestMarkit(connectionId: string) {
    try {
      const result = await testShopMarkitConnection(connectionId);
      if (result.success) {
        toast.success(result.message || 'Connection successful');
      } else {
        toast.error(result.message || 'Connection failed');
      }
    } catch {
      toast.error('Connection test failed');
    }
  }

  // ---- Handlers: Settings ----

  function handleSaveSettings() {
    const ecom = config.ecommerce || {};
    const markit = config.markit || {};
    saveConfigMutation.mutate({
      sync: { enabled: ecom.syncEnabled, intervalMs: ecom.syncIntervalMs, batchSize: ecom.batchSize },
      orders: { autoSync: ecom.orders?.autoSync, defaultWarehouse: ecom.orders?.defaultWarehouse, defaultBranch: ecom.orders?.defaultBranch },
      products: { autoSync: ecom.products?.autoSync, syncInventory: ecom.products?.syncInventory, syncPrices: ecom.products?.syncPrices },
      customers: { autoSync: ecom.customers?.autoSync },
      markit: { enabled: markit.enabled, syncIntervalMs: markit.syncIntervalMs, batchSize: markit.batchSize },
    });
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => toast.success('Copied to clipboard')).catch(() => toast.error('Failed to copy'));
  }

  // ---- Column Definitions ----

  const ecomColumns: ColumnDef<ShopConnection>[] = [
    { key: 'PlatformCode', label: 'Platform', width: 120, sortable: true, render: (val) => <StatusBadge status={String(val).toLowerCase() === 'shopify' ? 'success' : 'info'} label={val || '-'} size="sm" /> },
    { key: 'StoreName', label: 'Store', sortable: true, render: (val, row) => <span className="font-medium text-dark-700">{val || row.ShopDomain || '-'}</span> },
    { key: 'IsActive', label: 'Status', width: 90, render: (val) => <StatusBadge status={val ? 'success' : 'neutral'} label={val ? 'Active' : 'Inactive'} size="sm" /> },
    { key: 'LastSyncAt', label: 'Last Sync', width: 150, render: (val) => <span className="text-dark-400 text-xs">{val ? new Date(val).toLocaleString() : 'Never'}</span> },
    {
      key: 'stats', label: 'Stats', width: 200,
      render: (_val, row) => (
        <span className="text-dark-400 text-xs">
          Orders: {row.stats?.orders?.total || 0} | Products: {row.stats?.products?.total || 0} | Customers: {row.stats?.customers?.total || 0}
        </span>
      ),
    },
    {
      key: 'ConnectionId', label: 'Actions', width: 180, sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => syncEcomMutation.mutate({ id: row.ConnectionId, type: 'all' })} className="p-1.5 text-dark-400 hover:text-primary rounded hover:bg-dark-100 transition-colors" title="Sync"><RefreshCw className="w-4 h-4" /></button>
          <button type="button" onClick={() => openEditEcom(row)} className="p-1.5 text-dark-400 hover:text-primary rounded hover:bg-dark-100 transition-colors" title="Edit"><Edit className="w-4 h-4" /></button>
          <button type="button" onClick={() => handleTestEcom(row.ConnectionId)} className="p-1.5 text-dark-400 hover:text-primary rounded hover:bg-dark-100 transition-colors" title="Test"><Wifi className="w-4 h-4" /></button>
          <button type="button" onClick={() => deleteEcomModal.open(row)} className="p-1.5 text-dark-400 hover:text-danger rounded hover:bg-dark-100 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  const markitConnectionColumns: ColumnDef<ShopMarkitConnection>[] = [
    { key: 'PlatformCode', label: 'Platform', width: 120, sortable: true, render: (val) => <StatusBadge status={val === 'brevo' ? 'info' : 'warning'} label={val} size="sm" /> },
    { key: 'Name', label: 'Name', sortable: true, render: (val) => <span className="font-medium text-dark-700">{val}</span> },
    { key: 'IsActive', label: 'Status', width: 90, render: (val) => <StatusBadge status={val ? 'success' : 'neutral'} label={val ? 'Active' : 'Inactive'} size="sm" /> },
    { key: 'LastSyncAt', label: 'Last Sync', width: 150, render: (val) => <span className="text-dark-400 text-xs">{val ? new Date(val).toLocaleString() : 'Never'}</span> },
    {
      key: 'ConnectionId', label: 'Actions', width: 140, sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => handleTestMarkit(row.ConnectionId)} className="p-1.5 text-dark-400 hover:text-primary rounded hover:bg-dark-100 transition-colors" title="Test"><Wifi className="w-4 h-4" /></button>
          <button type="button" onClick={() => openEditMarkit(row)} className="p-1.5 text-dark-400 hover:text-primary rounded hover:bg-dark-100 transition-colors" title="Edit"><Edit className="w-4 h-4" /></button>
          <button type="button" onClick={() => deleteMarkitModal.open(row)} className="p-1.5 text-dark-400 hover:text-danger rounded hover:bg-dark-100 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  const markitListColumns: ColumnDef<ShopMarkitList>[] = [
    { key: 'Name', label: 'Name', sortable: true, render: (val) => <span className="font-medium text-dark-700">{val}</span> },
    { key: 'ConnectionId', label: 'Connection', render: (val) => { const c = markitConnections.find(mc => mc.ConnectionId === val); return <span className="text-dark-400">{c ? c.Name : val}</span>; } },
    { key: 'ContactCount', label: 'Contacts', width: 90, render: (val) => <span className="text-dark-400">{val || 0}</span> },
    { key: 'SyncStatus', label: 'Status', width: 100, render: (val) => <StatusBadge status={val === 'synced' || val === 'completed' ? 'success' : val === 'pending' || val === 'running' ? 'warning' : 'neutral'} label={val || '-'} size="sm" /> },
    { key: 'LastSyncAt', label: 'Last Sync', width: 150, render: (val) => <span className="text-dark-400 text-xs">{val ? new Date(val).toLocaleString() : 'Never'}</span> },
    {
      key: 'ListId', label: 'Actions', width: 80, sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => syncListMutation.mutate(row.ListId)} className="p-1.5 text-dark-400 hover:text-primary rounded hover:bg-dark-100 transition-colors" title="Sync Now"><RefreshCw className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  const exportColumns: ColumnDef<ShopMarkitExport>[] = [
    { key: 'CreatedAt', label: 'Date', width: 170, sortable: true, render: (val) => <span className="text-dark-500">{new Date(val).toLocaleString()}</span> },
    { key: 'ListName', label: 'List', sortable: true, render: (val, row) => <span className="text-dark-600">{val || row.ListId || '-'}</span> },
    { key: 'Status', label: 'Status', width: 100, render: (val) => <StatusBadge status={val === 'completed' || val === 'success' ? 'success' : val === 'running' || val === 'pending' ? 'warning' : val === 'failed' || val === 'error' ? 'danger' : 'neutral'} label={val} size="sm" /> },
    { key: 'ProcessedContacts', label: 'Progress', width: 120, render: (val, row) => <span className="text-dark-400">{val || 0} / {row.TotalContacts || 0}</span> },
    { key: 'SuccessCount', label: 'Result', width: 140, render: (val, row) => <span className="text-dark-400">{val || 0} success, {row.ErrorCount || 0} errors</span> },
  ];

  const campaignColumns: ColumnDef<ShopMarkitCampaign>[] = [
    { key: 'Name', label: 'Name', sortable: true, render: (val) => <span className="font-medium text-dark-700">{val}</span> },
    { key: 'Channel', label: 'Channel', width: 100, render: (val) => <StatusBadge status={val === 'email' ? 'info' : val === 'sms' ? 'success' : 'warning'} label={val} size="sm" /> },
    { key: 'Status', label: 'Status', width: 100, render: (val) => <span className="text-dark-500">{val}</span> },
    { key: 'SentAt', label: 'Sent', width: 150, render: (val) => <span className="text-dark-400 text-xs">{val ? new Date(val).toLocaleString() : '-'}</span> },
    { key: 'Stats', label: 'Stats', width: 160, render: (val) => val ? <span className="text-dark-400">Opens: {val.opens || 0} | Clicks: {val.clicks || 0}</span> : <span className="text-dark-400">-</span> },
  ];

  // ---- Render ----

  const ecomStatus = status.ecommerce || {};
  const markitStatus = status.markit || {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="ShopIT Admin"
        description="Manage e-commerce, marketing, products, and orders"
        icon={<ShoppingCart className="w-5 h-5" />}
      />

      <PageStatusBar
        items={[
          { type: 'badge', label: 'E-com', status: ecomStatus.enabled ? 'success' : 'neutral', badgeLabel: ecomStatus.enabled ? 'Enabled' : 'Disabled' },
          { type: 'badge', label: 'Marketing', status: markitStatus.enabled ? 'success' : 'neutral', badgeLabel: markitStatus.enabled ? 'Enabled' : 'Disabled' },
        ] as StatusBarItem[]}
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab: Dashboard */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* E-commerce Status */}
            <Card title="E-commerce Status" headerAction={<StatusBadge status={ecomStatus.enabled ? 'success' : 'neutral'} label={ecomStatus.enabled ? 'Enabled' : 'Disabled'} size="sm" />}>
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Active Connections" value={String(ecomStatus.connections?.active || 0)} />
                <StatCard label="Orders Pending" value={String(ecomStatus.queue?.ordersPending || 0)} />
                <StatCard label="Orders Error" value={String(ecomStatus.queue?.ordersError || 0)} />
                <StatCard label="Products Synced" value={String(ecomStatus.queue?.productsSynced || 0)} />
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full ${ecomStatus.sync?.running ? 'bg-success animate-pulse' : 'bg-dark-300'}`} />
                <span className="text-dark-400">Sync: {ecomStatus.sync?.running ? 'Running' : 'Idle'}</span>
                {ecomStatus.sync?.lastRun && <span className="text-dark-400 text-xs">| Last: {new Date(ecomStatus.sync.lastRun).toLocaleString()}</span>}
              </div>
            </Card>

            {/* Marketing Status */}
            <Card title="Marketing Status" headerAction={<StatusBadge status={markitStatus.enabled ? 'success' : 'neutral'} label={markitStatus.enabled ? 'Enabled' : 'Disabled'} size="sm" />}>
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Connections" value={String(markitStatus.connections?.active || 0)} />
                <StatCard label="Audience Lists" value={String(markitStatus.lists?.total || 0)} />
                <StatCard label="Pending Exports" value={String(markitStatus.exports?.pending || 0)} />
                <StatCard label="Contacts Synced" value={String(markitStatus.sync?.stats?.contactsSynced || 0)} />
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full ${markitStatus.sync?.running ? 'bg-success animate-pulse' : 'bg-dark-300'}`} />
                <span className="text-dark-400">Sync: {markitStatus.sync?.running ? 'Running' : 'Idle'}</span>
              </div>
            </Card>
          </div>

          {/* Queue Summary */}
          {queue && (
            <Card title="Sync Queue">
              <div className="grid grid-cols-3 gap-4">
                <StatCard label="Orders Pending" value={String(queue.orders?.pending || 0)} />
                <StatCard label="Products Pending" value={String(queue.products?.pending || 0)} />
                <StatCard label="Customers Pending" value={String(queue.customers?.pending || 0)} />
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Tab: E-commerce */}
      {activeTab === 'ecommerce' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-dark-400">{connections.length} connections</span>
            <Button icon={<Plus className="w-4 h-4" />} onClick={openCreateEcom}>Add Connection</Button>
          </div>
          {connectionsLoading ? <div className="flex justify-center py-8"><LoadingSpinner /></div> : (
            <DataTable<ShopConnection>
              id="shop-ecom-connections"
              columns={ecomColumns}
              data={connections}
              rowKey="ConnectionId"
              onRowClick={openEditEcom}
              emptyMessage="No e-commerce connections configured"
              emptyIcon={Link2}
            />
          )}
        </div>
      )}

      {/* Tab: Marketing */}
      {activeTab === 'marketing' && (
        <div className="space-y-6">
          {/* Marketing Connections */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-dark-600">Marketing Connections</h3>
              <Button icon={<Plus className="w-4 h-4" />} size="sm" onClick={openCreateMarkit}>Add Connection</Button>
            </div>
            {markitConnectionsLoading ? <div className="flex justify-center py-8"><LoadingSpinner /></div> : (
              <DataTable<ShopMarkitConnection>
                id="shop-markit-connections"
                columns={markitConnectionColumns}
                data={markitConnections}
                rowKey="ConnectionId"
                onRowClick={openEditMarkit}
                emptyMessage="No marketing connections configured"
                emptyIcon={Mail}
              />
            )}
          </div>

          {/* Audience Lists */}
          {markitLists.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-dark-600">Audience Lists</h3>
              <DataTable<ShopMarkitList>
                id="shop-markit-lists"
                columns={markitListColumns}
                data={markitLists}
                rowKey="ListId"
                emptyMessage="No audience lists"
              />
            </div>
          )}

          {/* Export History */}
          {markitExports.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-dark-600">Export History</h3>
              <DataTable<ShopMarkitExport>
                id="shop-markit-exports"
                columns={exportColumns}
                data={markitExports}
                rowKey="CreatedAt"
                emptyMessage="No export history"
              />
            </div>
          )}

          {/* Campaigns */}
          {markitCampaigns.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-dark-600">Campaigns</h3>
              <DataTable<ShopMarkitCampaign>
                id="shop-markit-campaigns"
                columns={campaignColumns}
                data={markitCampaigns}
                rowKey="Name"
                emptyMessage="No campaigns"
              />
            </div>
          )}
        </div>
      )}

      {/* Tab: Settings */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Sync Service Control */}
          <Card title="Sync Service Control">
            <div className="flex items-center gap-3 mb-3">
              <Button size="sm" icon={<Play className="w-3.5 h-3.5" />} onClick={() => startSyncMutation.mutate()} loading={startSyncMutation.isPending}>Start</Button>
              <Button variant="secondary" size="sm" icon={<Square className="w-3.5 h-3.5" />} onClick={() => stopSyncMutation.mutate()} loading={stopSyncMutation.isPending}>Stop</Button>
              <Button variant="secondary" size="sm" icon={<Zap className="w-3.5 h-3.5" />} onClick={() => triggerSyncMutation.mutate()} loading={triggerSyncMutation.isPending}>Sync Now</Button>
            </div>
            <p className="text-xs text-dark-400">Changes to settings below require a restart to take effect.</p>
          </Card>

          {/* E-commerce Settings */}
          <Card title="E-commerce Settings">
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm text-dark-600 cursor-pointer">
                <input type="checkbox" defaultChecked={config.ecommerce?.syncEnabled !== false} className="rounded border-dark-300 bg-dark-200 text-primary focus:ring-primary/50" />
                Enable automatic sync
              </label>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Sync Interval (ms)">
                  <input type="number" defaultValue={config.ecommerce?.syncIntervalMs || 300000} className="form-input" />
                </FormField>
                <FormField label="Batch Size">
                  <input type="number" defaultValue={config.ecommerce?.batchSize || 50} className="form-input" />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Default Warehouse">
                  <input type="text" defaultValue={config.ecommerce?.orders?.defaultWarehouse || ''} className="form-input" placeholder="WH01" />
                </FormField>
                <FormField label="Default Branch">
                  <input type="text" defaultValue={config.ecommerce?.orders?.defaultBranch || ''} className="form-input" placeholder="B1" />
                </FormField>
              </div>
            </div>
          </Card>

          {/* Webhook URLs */}
          {config.webhookUrls && Object.keys(config.webhookUrls).length > 0 && (
            <Card title="Webhook URLs">
              <div className="space-y-3">
                {Object.entries(config.webhookUrls).map(([key, url]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-sm text-dark-500 w-32 capitalize">{key}</span>
                    <input type="text" value={url} readOnly className="form-input flex-1 text-xs" />
                    <button type="button" onClick={() => copyToClipboard(url)} className="p-1.5 text-dark-400 hover:text-primary rounded hover:bg-dark-100 transition-colors" title="Copy"><Copy className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => queryClient.invalidateQueries({ queryKey: ['admin', 'shop', 'config'] })}>Reset</Button>
            <Button onClick={handleSaveSettings} loading={saveConfigMutation.isPending}>Save Settings</Button>
          </div>
        </div>
      )}

      {/* E-commerce Connection Modal */}
      <Modal
        isOpen={ecomModal.isOpen}
        onClose={ecomModal.close}
        title={isEditingEcom ? 'Edit Connection' : 'Add E-commerce Connection'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={ecomModal.close}>Cancel</Button>
            <Button onClick={handleSaveEcom} loading={createEcomMutation.isPending || updateEcomMutation.isPending}>
              {isEditingEcom ? 'Save Changes' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Platform" required>
              <select value={ecomForm.platformId} onChange={(e) => setEcomForm({ ...ecomForm, platformId: e.target.value })} className="form-input" title="Platform" disabled={isEditingEcom}>
                <option value="">Select platform...</option>
                {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </FormField>
            <FormField label="Store Name" required>
              <input type="text" value={ecomForm.storeName} onChange={(e) => setEcomForm({ ...ecomForm, storeName: e.target.value })} className="form-input" placeholder="My Store" />
            </FormField>
          </div>
          <FormField label="Store URL">
            <input type="text" value={ecomForm.storeUrl} onChange={(e) => setEcomForm({ ...ecomForm, storeUrl: e.target.value })} className="form-input" placeholder="https://mystore.myshopify.com" />
          </FormField>
          <FormField label="API Key / Access Token">
            <input type="password" value={ecomForm.accessToken} onChange={(e) => setEcomForm({ ...ecomForm, accessToken: e.target.value })} className="form-input" placeholder="Enter API key" />
          </FormField>

          <div className="border-t border-dark-200 pt-4">
            <h4 className="text-xs font-medium text-dark-500 mb-3">Sync Settings</h4>
            <div className="flex flex-wrap gap-4">
              {(['syncEnabled', 'syncOrders', 'syncProducts', 'syncCustomers', 'syncInventory'] as const).map(field => (
                <label key={field} className="flex items-center gap-2 text-sm text-dark-600 cursor-pointer">
                  <input type="checkbox" checked={ecomForm[field]} onChange={(e) => setEcomForm({ ...ecomForm, [field]: e.target.checked })} className="rounded border-dark-300 bg-dark-200 text-primary focus:ring-primary/50" />
                  {field.replace('sync', 'Sync ').replace('Enabled', 'Enabled')}
                </label>
              ))}
            </div>
          </div>

          <div className="border-t border-dark-200 pt-4">
            <h4 className="text-xs font-medium text-dark-500 mb-3">ERP Defaults</h4>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Default Warehouse"><input type="text" value={ecomForm.defaultWarehouse} onChange={(e) => setEcomForm({ ...ecomForm, defaultWarehouse: e.target.value })} className="form-input" placeholder="WH01" /></FormField>
              <FormField label="Default Branch"><input type="text" value={ecomForm.defaultBranch} onChange={(e) => setEcomForm({ ...ecomForm, defaultBranch: e.target.value })} className="form-input" placeholder="B1" /></FormField>
              <FormField label="Default Sales Rep"><input type="text" value={ecomForm.defaultSalesRep} onChange={(e) => setEcomForm({ ...ecomForm, defaultSalesRep: e.target.value })} className="form-input" placeholder="REP001" /></FormField>
              <FormField label="Default Tax Code"><input type="text" value={ecomForm.defaultTaxCode} onChange={(e) => setEcomForm({ ...ecomForm, defaultTaxCode: e.target.value })} className="form-input" placeholder="TAX1" /></FormField>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-dark-600 cursor-pointer">
            <input type="checkbox" checked={ecomForm.isActive} onChange={(e) => setEcomForm({ ...ecomForm, isActive: e.target.checked })} className="rounded border-dark-300 bg-dark-200 text-primary focus:ring-primary/50" />
            Connection Active
          </label>
        </div>
      </Modal>

      {/* Delete E-commerce Modal */}
      <Modal isOpen={deleteEcomModal.isOpen} onClose={deleteEcomModal.close} title="Delete Connection" size="sm" footer={
        <>
          <Button variant="secondary" onClick={deleteEcomModal.close}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteEcomModal.data && deleteEcomMutation.mutate(deleteEcomModal.data.ConnectionId)} loading={deleteEcomMutation.isPending}>Delete</Button>
        </>
      }>
        <p className="text-sm text-dark-500">Are you sure you want to delete <strong className="text-dark-700">{deleteEcomModal.data?.StoreName}</strong>? This action cannot be undone.</p>
      </Modal>

      {/* Marketing Connection Modal */}
      <Modal
        isOpen={markitModal.isOpen}
        onClose={markitModal.close}
        title={isEditingMarkit ? 'Edit Marketing Connection' : 'Add Marketing Connection'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={markitModal.close}>Cancel</Button>
            <Button onClick={handleSaveMarkit} loading={createMarkitMutation.isPending || updateMarkitMutation.isPending}>
              {isEditingMarkit ? 'Save Changes' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Platform" required>
            <select value={markitForm.platformCode} onChange={(e) => setMarkitForm({ ...markitForm, platformCode: e.target.value })} className="form-input" title="Platform">
              {MARKIT_PLATFORMS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </FormField>
          <FormField label="Connection Name" required>
            <input type="text" value={markitForm.name} onChange={(e) => setMarkitForm({ ...markitForm, name: e.target.value })} className="form-input" placeholder="My Brevo Connection" />
          </FormField>
          <FormField label="API Key" required>
            <input type="password" value={markitForm.apiKey} onChange={(e) => setMarkitForm({ ...markitForm, apiKey: e.target.value })} className="form-input" placeholder="Enter API key" />
          </FormField>
          {markitForm.platformCode === 'mailchimp' && (
            <FormField label="API URL">
              <input type="text" value={markitForm.apiUrl} onChange={(e) => setMarkitForm({ ...markitForm, apiUrl: e.target.value })} className="form-input" placeholder="https://usX.api.mailchimp.com" />
            </FormField>
          )}
          <label className="flex items-center gap-2 text-sm text-dark-600 cursor-pointer">
            <input type="checkbox" checked={markitForm.isActive} onChange={(e) => setMarkitForm({ ...markitForm, isActive: e.target.checked })} className="rounded border-dark-300 bg-dark-200 text-primary focus:ring-primary/50" />
            Active
          </label>
        </div>
      </Modal>

      {/* Delete Marketing Modal */}
      <Modal isOpen={deleteMarkitModal.isOpen} onClose={deleteMarkitModal.close} title="Delete Marketing Connection" size="sm" footer={
        <>
          <Button variant="secondary" onClick={deleteMarkitModal.close}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteMarkitModal.data && deleteMarkitMutation.mutate(deleteMarkitModal.data.ConnectionId)} loading={deleteMarkitMutation.isPending}>Delete</Button>
        </>
      }>
        <p className="text-sm text-dark-500">Are you sure you want to delete <strong className="text-dark-700">{deleteMarkitModal.data?.Name}</strong>?</p>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-dark-100/50 border border-dark-200 rounded-lg p-3">
      <p className="text-xs text-dark-400 mb-0.5">{label}</p>
      <p className="text-lg font-semibold text-dark-700">{value}</p>
    </div>
  );
}

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
