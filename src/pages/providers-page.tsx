import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Plug, Star, Zap, Wifi, WifiOff, CheckCircle, XCircle, AlertTriangle, Server, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  Card,
  Modal,
  StatusBadge,
  Tabs,
  LoadingSpinner,
  PageHeader,
} from '@/components/shared';
import type { TabItem } from '@/components/shared';
import {
  getProviders,
  getProviderTypes,
  createProvider,
  updateProvider,
  deleteProvider,
  destroyProvider,
  testProvider,
  setProviderDefault,
} from '@/services/admin-service';
import { useModal } from '@shared/hooks';
import type { Provider, ProviderType } from '@/types';
import ProviderEditModal from './components/provider-edit-modal';
import type { ProviderForm } from './components/provider-edit-modal';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = ['EMAIL', 'LABEL', 'STORAGE', 'EXCHANGE_RATE', 'AI', 'AUTOMATION', 'OAUTH'] as const;
type Category = typeof CATEGORIES[number];

const CATEGORY_LABELS: Record<Category, string> = {
  EMAIL: 'Email',
  LABEL: 'Label',
  STORAGE: 'Storage',
  EXCHANGE_RATE: 'Exchange Rate',
  AI: 'AI',
  AUTOMATION: 'Automation',
  OAUTH: 'OAuth',
};

const APP_CODES = ['BRIDGE', 'CONNECT', 'STACK', 'FLOOR', 'FLIP', 'ADMIN', 'PULP', 'INFUSE', 'SHOP', 'LIC'] as const;

const tabs: TabItem[] = CATEGORIES.map((cat) => ({
  id: cat,
  label: CATEGORY_LABELS[cat],
  icon: cat === 'INTERNAL' ? <Server className="w-4 h-4" /> : <Plug className="w-4 h-4" />,
}));

const INITIAL_FORM: ProviderForm = {
  providerTypeCode: '',
  name: '',
  description: '',
  configuration: '{}',
  credentials: '{}',
  applications: [],
  scope: 'external',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProvidersPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>(CATEGORIES[0]);

  // Modals
  const providerModal = useModal<Provider>();
  const destroyModal = useModal<Provider>();
  const [destroyConfirm, setDestroyConfirm] = useState('');

  // Forms
  const [form, setForm] = useState<ProviderForm>(INITIAL_FORM);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [jsonErrors, setJsonErrors] = useState<{ config?: string; creds?: string }>({});
  const [testingId, setTestingId] = useState<string | null>(null);

  // ---- Queries ----

  const { data: providersData, isLoading: providersLoading } = useQuery({
    queryKey: ['admin', 'providers'],
    queryFn: () => getProviders(),
  });

  const { data: typesData } = useQuery({
    queryKey: ['admin', 'provider-types'],
    queryFn: () => getProviderTypes(),
  });

  // ---- Derived data ----

  const allProviders: Provider[] = providersData?.data || [];
  const allTypes: ProviderType[] = typesData?.data || [];

  // Build a type lookup for checking IsBuiltIn on provider cards
  const typeMap = useMemo(() => {
    const map: Record<string, ProviderType> = {};
    for (const t of allTypes) map[t.TypeCode] = t;
    return map;
  }, [allTypes]);

  const filteredTypes = allTypes.filter((t) => t.Category === activeTab);
  // Creatable types exclude built-in types (e.g. STORAGE_LOCAL)
  const creatableTypes = filteredTypes.filter((t) => !t.IsBuiltIn);
  // Filter out built-in provider records — they are invisible in the admin UI
  const filteredProviders = allProviders.filter(
    (p) => p.Category === activeTab && !typeMap[p.ProviderTypeCode]?.IsBuiltIn
  );

  const appConflicts = useMemo(() => {
    if (!form.providerTypeCode) return {} as Record<string, string>;
    const map: Record<string, string> = {};
    for (const p of allProviders) {
      if (p.ProviderTypeCode === form.providerTypeCode && p.IsActive && p.ProviderId !== editingId) {
        for (const app of (p.Applications || [])) {
          map[app] = p.Name;
        }
      }
    }
    return map;
  }, [allProviders, form.providerTypeCode, editingId]);

  // ---- Mutations ----

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => createProvider(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'providers'] });
      providerModal.close();
      toast.success('Provider created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create provider'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updateProvider(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'providers'] });
      providerModal.close();
      toast.success('Provider updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update provider'),
  });

  const destroyMutation = useMutation({
    mutationFn: (id: string) => destroyProvider(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'providers'] });
      destroyModal.close();
      setDestroyConfirm('');
      toast.success('Provider permanently deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete provider'),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => setProviderDefault(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'providers'] });
      toast.success('Default provider updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to set default'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateProvider(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'providers'] });
      toast.success('Provider status updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update provider status'),
  });

  // ---- Handlers ----

  function openCreate() {
    const defaultScope = activeTab === 'INTERNAL' ? 'internal' : 'external';
    setForm({ ...INITIAL_FORM, providerTypeCode: creatableTypes[0]?.TypeCode || '', scope: defaultScope });
    setIsEditing(false);
    setEditingId(null);
    setJsonErrors({});
    providerModal.open();
  }

  function openEdit(p: Provider) {
    setForm({
      providerTypeCode: p.ProviderTypeCode,
      name: p.Name,
      description: p.Description || '',
      configuration: p.Configuration ? JSON.stringify(p.Configuration, null, 2) : '{}',
      credentials: p.Credentials ? JSON.stringify(p.Credentials, null, 2) : '{}',
      applications: p.Applications || [],
      scope: p.Scope || 'external',
    });
    setIsEditing(true);
    setEditingId(p.ProviderId);
    setJsonErrors({});
    providerModal.open(p);
  }

  function validateJson(value: string, field: 'config' | 'creds'): boolean {
    try {
      JSON.parse(value);
      setJsonErrors((prev) => ({ ...prev, [field]: undefined }));
      return true;
    } catch {
      setJsonErrors((prev) => ({ ...prev, [field]: 'Invalid JSON' }));
      return false;
    }
  }

  function handleSave() {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.providerTypeCode) { toast.error('Provider type is required'); return; }

    const configValid = validateJson(form.configuration, 'config');
    const credsValid = validateJson(form.credentials, 'creds');
    if (!configValid || !credsValid) return;

    const data: Record<string, unknown> = {
      providerTypeCode: form.providerTypeCode,
      name: form.name,
      description: form.description || null,
      configuration: JSON.parse(form.configuration),
      credentials: JSON.parse(form.credentials),
      applications: form.applications,
      scope: form.scope,
    };

    if (isEditing && editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  }

  const handleTest = useCallback(async (provider: Provider) => {
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
  }, [queryClient]);

  function toggleApp(appCode: string) {
    setForm((prev) => {
      const apps = prev.applications.includes(appCode)
        ? prev.applications.filter((a) => a !== appCode)
        : [...prev.applications, appCode];
      return { ...prev, applications: apps };
    });
  }

  // ---- Health helpers ----

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

  // ---- Render ----

  if (providersLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Providers"
        description="Manage service provider configurations"
        actions={
          <div className="flex items-center gap-4 text-sm text-semantic-text-faint">
            <span><Plug className="w-3.5 h-3.5 inline mr-1" />{allProviders.length} providers</span>
          </div>
        }
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Provider cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-semantic-text-subtle">
            {CATEGORY_LABELS[activeTab as Category]} Providers
            <span className="ml-2 text-semantic-text-faint">({filteredProviders.length})</span>
          </h3>
          <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate} disabled={creatableTypes.length === 0}>
            Add Provider
          </Button>
        </div>

        {filteredProviders.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <Plug className="w-10 h-10 mx-auto mb-3 text-semantic-text-faint" />
              <h3 className="text-lg font-medium text-semantic-text-primary mb-1">No Providers</h3>
              <p className="text-sm text-semantic-text-faint">
                No {CATEGORY_LABELS[activeTab as Category].toLowerCase()} providers configured yet.
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredProviders.map((provider) => (
              <Card key={provider.ProviderId} className={!provider.IsActive ? 'opacity-60' : ''}>
                <div className="space-y-3">
                  {/* Header row */}
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-semantic-text-default truncate">
                          {provider.Name}
                        </h4>
                        {provider.IsDefault && (
                          <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-semantic-text-faint">
                          {provider.TypeDisplayName || provider.ProviderTypeCode}
                        </p>
                        {provider.Scope === 'internal' ? (
                          <span className="flex items-center gap-0.5 text-[10px] text-semantic-text-faint">
                            <Server className="w-2.5 h-2.5" /> Internal
                          </span>
                        ) : provider.Scope === 'external' && provider.Category === 'INTERNAL' ? (
                          <span className="flex items-center gap-0.5 text-[10px] text-semantic-text-faint">
                            <Globe className="w-2.5 h-2.5" /> External
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <StatusBadge
                      status={getHealthStatus(provider)}
                      label={getHealthLabel(provider)}
                      size="sm"
                    />
                  </div>

                  {/* Description */}
                  {provider.Description && (
                    <p className="text-xs text-semantic-text-subtle line-clamp-2">
                      {provider.Description}
                    </p>
                  )}

                  {/* App badges */}
                  {provider.Applications && provider.Applications.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {provider.Applications.map((app) => (
                        <span
                          key={app}
                          className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-surface-subtle text-semantic-text-subtle"
                        >
                          {app}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Status row */}
                  <div className="flex items-center gap-2 text-xs text-semantic-text-faint">
                    {provider.IsActive ? (
                      <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-success" /> Active</span>
                    ) : (
                      <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-danger" /> Inactive</span>
                    )}
                    {provider.LastTestedAt && (
                      <span className="ml-auto">
                        Tested {new Date(provider.LastTestedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 pt-2 border-t border-border">
                    <button
                      type="button"
                      onClick={() => openEdit(provider)}
                      className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTest(provider)}
                      disabled={testingId === provider.ProviderId}
                      className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover transition-colors disabled:opacity-50"
                      title="Test Connection"
                    >
                      {testingId === provider.ProviderId ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <Zap className="w-4 h-4" />
                      )}
                    </button>
                    {!provider.IsDefault && (
                      <button
                        type="button"
                        onClick={() => setDefaultMutation.mutate(provider.ProviderId)}
                        className="p-1.5 text-semantic-text-faint hover:text-amber-400 rounded hover:bg-interactive-hover transition-colors"
                        title="Set as Default"
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    )}
                    {/* Activate/Deactivate toggle */}
                    <button
                      type="button"
                      onClick={() => toggleActiveMutation.mutate({
                        id: provider.ProviderId,
                        isActive: !provider.IsActive,
                      })}
                      className={`p-1.5 rounded hover:bg-interactive-hover transition-colors ${
                        provider.IsActive
                          ? 'text-success hover:text-danger'
                          : 'text-danger hover:text-success'
                      }`}
                      title={provider.IsActive ? 'Deactivate' : 'Activate'}
                    >
                      {provider.IsActive ? (
                        <Wifi className="w-4 h-4" />
                      ) : (
                        <WifiOff className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => destroyModal.open(provider)}
                      className="p-1.5 text-semantic-text-faint hover:text-danger rounded hover:bg-interactive-hover transition-colors ml-auto"
                      title="Delete permanently"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal (extracted component with General + API tabs) */}
      <ProviderEditModal
        isOpen={providerModal.isOpen}
        onClose={providerModal.close}
        provider={providerModal.data || null}
        isEditing={isEditing}
        providerTypes={creatableTypes}
        form={form}
        onFormChange={setForm}
        onSave={handleSave}
        isSaving={createMutation.isPending || updateMutation.isPending}
        appConflicts={appConflicts}
        appCodes={APP_CODES}
        jsonErrors={jsonErrors}
        onValidateJson={validateJson}
        onToggleApp={toggleApp}
      />

      {/* Permanent Delete Confirmation Modal */}
      <Modal
        isOpen={destroyModal.isOpen}
        onClose={() => { destroyModal.close(); setDestroyConfirm(''); }}
        title="Delete Provider"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { destroyModal.close(); setDestroyConfirm(''); }}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => destroyModal.data && destroyMutation.mutate(destroyModal.data.ProviderId)}
              loading={destroyMutation.isPending}
              disabled={destroyConfirm !== 'DELETE'}
            >
              Delete Permanently
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
            <p className="text-sm text-semantic-text-subtle">
              This will permanently delete <strong className="text-semantic-text-default">{destroyModal.data?.Name}</strong> and
              all its application assignments. This action cannot be undone.
            </p>
          </div>
          <div>
            <label className="block text-xs text-semantic-text-faint mb-1">
              Type <strong className="text-semantic-text-default">DELETE</strong> to confirm
            </label>
            <input
              type="text"
              value={destroyConfirm}
              onChange={(e) => setDestroyConfirm(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded bg-semantic-bg-input border border-semantic-border-default text-semantic-text-default placeholder:text-semantic-text-faint focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="DELETE"
              autoFocus
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
