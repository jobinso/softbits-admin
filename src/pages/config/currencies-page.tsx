import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Coins, Plus, Edit, Trash2, RefreshCw, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  DataTable,
  Button,
  Modal,
  StatusBadge,
  LoadingSpinner,
  Tabs,
  PageHeader,
  TableCard,
} from '@/components/shared';
import type { ColumnDef, TabItem } from '@/components/shared';
import {
  getCurrencies,
  createCurrency,
  updateCurrency,
  deleteCurrency,
  setDefaultCurrency,
  getExchangeRateProvider,
  updateExchangeRateProvider,
  fetchExchangeRatesNow,
  getExchangeRates,
  createExchangeRate,
  updateExchangeRate,
  deleteExchangeRate,
  getProvidersByType,
} from '@/services/admin-service';
import { useModal } from '@shared/hooks';
import type { Currency, ExchangeRateProvider, ExchangeRate, Provider } from '@/types';

// ---------------------------------------------------------------------------
// Form types
// ---------------------------------------------------------------------------

interface CurrencyForm {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isDefault: boolean;
}

interface RateForm {
  toCurrency: string;
  rate: string;
  rateDate: string;
}

const INITIAL_CURRENCY_FORM: CurrencyForm = { code: '', name: '', symbol: '', decimalPlaces: 2, isDefault: false };
const INITIAL_RATE_FORM: RateForm = { toCurrency: '', rate: '', rateDate: new Date().toISOString().split('T')[0] };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CurrenciesPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('currencies');
  const [rateDate, setRateDate] = useState(new Date().toISOString().split('T')[0]);
  const currencyModal = useModal<Currency>();
  const deleteModal = useModal<Currency>();
  const rateModal = useModal<ExchangeRate>();
  const deleteRateModal = useModal<ExchangeRate>();
  const [currencyForm, setCurrencyForm] = useState<CurrencyForm>(INITIAL_CURRENCY_FORM);
  const [rateForm, setRateForm] = useState<RateForm>(INITIAL_RATE_FORM);
  const [isEditingCurrency, setIsEditingCurrency] = useState(false);
  const [editingCurrencyId, setEditingCurrencyId] = useState<string | null>(null);
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [editingRateId, setEditingRateId] = useState<string | null>(null);

  // ---- Provider form state ----
  const [providerForm, setProviderForm] = useState<Partial<ExchangeRateProvider>>({});
  const [selectedProviderId, setSelectedProviderId] = useState('');

  // ---- Tabs ----
  const tabs: TabItem[] = [
    { id: 'currencies', label: 'Currencies' },
    { id: 'rates', label: 'Exchange Rates' },
    { id: 'provider', label: 'Provider' },
  ];

  // ---- Data fetching ----

  const { data: currenciesResponse, isLoading: currenciesLoading } = useQuery({
    queryKey: ['admin', 'currencies'],
    queryFn: getCurrencies,
  });

  const currencies: Currency[] = currenciesResponse?.data ?? [];

  const { data: providerResponse } = useQuery({
    queryKey: ['admin', 'exchange-rate-provider'],
    queryFn: getExchangeRateProvider,
    enabled: activeTab === 'provider',
  });

  const provider = providerResponse?.data;

  const { data: unifiedProvidersResponse } = useQuery({
    queryKey: ['admin', 'providers', 'EXCHANGE_RATE_API'],
    queryFn: () => getProvidersByType('EXCHANGE_RATE_API'),
    enabled: activeTab === 'provider',
  });

  const unifiedProviders: Provider[] = unifiedProvidersResponse?.data ?? [];

  const { data: ratesResponse, isLoading: ratesLoading } = useQuery({
    queryKey: ['admin', 'exchange-rates', rateDate],
    queryFn: () => getExchangeRates(rateDate),
    enabled: activeTab === 'rates',
  });

  const rates: ExchangeRate[] = ratesResponse?.data ?? [];

  // ---- Mutations ----

  const createCurrencyMutation = useMutation({
    mutationFn: (data: CurrencyForm) => createCurrency(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'currencies'] });
      currencyModal.close();
      toast.success('Currency created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create currency'),
  });

  const updateCurrencyMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Currency> }) => updateCurrency(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'currencies'] });
      currencyModal.close();
      toast.success('Currency updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update currency'),
  });

  const deleteCurrencyMutation = useMutation({
    mutationFn: (id: string) => deleteCurrency(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'currencies'] });
      deleteModal.close();
      toast.success('Currency deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete currency'),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => setDefaultCurrency(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'currencies'] });
      toast.success('Default currency updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to set default currency'),
  });

  const saveProviderMutation = useMutation({
    mutationFn: (data: Partial<ExchangeRateProvider>) => updateExchangeRateProvider(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'exchange-rate-provider'] });
      toast.success('Provider settings saved');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save provider'),
  });

  const fetchRatesMutation = useMutation({
    mutationFn: () => fetchExchangeRatesNow(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'exchange-rates'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'exchange-rate-provider'] });
      const count = result.data?.rateCount || 0;
      toast.success(`Fetched ${count} rates`);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to fetch rates'),
  });

  const createRateMutation = useMutation({
    mutationFn: (data: { toCurrency: string; rate: number; rateDate: string }) => createExchangeRate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'exchange-rates'] });
      rateModal.close();
      toast.success('Exchange rate saved');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save rate'),
  });

  const updateRateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { toCurrency?: string; rate?: number; rateDate?: string } }) => updateExchangeRate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'exchange-rates'] });
      rateModal.close();
      toast.success('Exchange rate updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update rate'),
  });

  const deleteRateMutation = useMutation({
    mutationFn: (id: string) => deleteExchangeRate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'exchange-rates'] });
      deleteRateModal.close();
      toast.success('Exchange rate deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete rate'),
  });

  // ---- Handlers ----

  function openCreateCurrency() {
    setCurrencyForm(INITIAL_CURRENCY_FORM);
    setIsEditingCurrency(false);
    setEditingCurrencyId(null);
    currencyModal.open();
  }

  function openEditCurrency(c: Currency) {
    setCurrencyForm({
      code: c.Code,
      name: c.Name,
      symbol: c.Symbol || '',
      decimalPlaces: c.DecimalPlaces ?? 2,
      isDefault: c.IsDefault,
    });
    setIsEditingCurrency(true);
    setEditingCurrencyId(c.Id);
    currencyModal.open(c);
  }

  function handleSaveCurrency() {
    if (!currencyForm.code.trim() || !currencyForm.name.trim() || !currencyForm.symbol.trim()) {
      toast.error('Code, name, and symbol are required');
      return;
    }
    if (isEditingCurrency && editingCurrencyId) {
      updateCurrencyMutation.mutate({ id: editingCurrencyId, data: currencyForm as Partial<Currency> });
    } else {
      createCurrencyMutation.mutate({ ...currencyForm, code: currencyForm.code.toUpperCase() });
    }
  }

  function handleSaveProvider() {
    if (!selectedProviderId) {
      toast.error('Please select a provider');
      return;
    }
    saveProviderMutation.mutate({
      providerId: selectedProviderId,
      isEnabled: providerForm.IsEnabled,
    } as Partial<ExchangeRateProvider>);
  }

  function openCreateRate() {
    setRateForm({ ...INITIAL_RATE_FORM, rateDate: rateDate });
    setIsEditingRate(false);
    setEditingRateId(null);
    rateModal.open();
  }

  function openEditRate(r: ExchangeRate) {
    setRateForm({ toCurrency: r.ToCurrency, rate: String(r.Rate), rateDate: r.RateDate || '' });
    setIsEditingRate(true);
    setEditingRateId(r.Id);
    rateModal.open(r);
  }

  function handleSaveRate() {
    if (!rateForm.toCurrency || !rateForm.rate) { toast.error('Currency and rate are required'); return; }
    const rateNum = parseFloat(rateForm.rate);
    if (isNaN(rateNum) || rateNum <= 0) { toast.error('Rate must be a positive number'); return; }
    if (isEditingRate && editingRateId) {
      updateRateMutation.mutate({ id: editingRateId, data: { toCurrency: rateForm.toCurrency, rate: rateNum, rateDate: rateForm.rateDate } });
    } else {
      createRateMutation.mutate({ toCurrency: rateForm.toCurrency, rate: rateNum, rateDate: rateForm.rateDate });
    }
  }

  // ---- Initialize provider form when data loads ----
  if (provider && !providerForm.Name) {
    setProviderForm({
      Name: provider.Name || '',
      IsEnabled: provider.IsEnabled !== false,
    });
    // Match legacy provider to unified provider by Name
    if (!selectedProviderId && unifiedProviders.length > 0) {
      const match = unifiedProviders.find(p => p.Name === provider.Name);
      if (match) setSelectedProviderId(match.ProviderId);
    }
  }

  // ---- Derive read-only config from selected unified provider ----
  const selectedProvider = unifiedProviders.find(p => p.ProviderId === selectedProviderId) || null;
  const providerConfig = selectedProvider?.Configuration as Record<string, string> | null;

  // ---- Column definitions ----

  const currencyColumns: ColumnDef<Currency>[] = [
    {
      key: 'Code',
      label: 'Code',
      width: 100,
      sortable: true,
      render: (val) => <code className="text-xs bg-info/10 text-info px-1.5 py-0.5 rounded font-semibold">{val}</code>,
    },
    { key: 'Name', label: 'Name', sortable: true, render: (val) => <span className="text-semantic-text-default">{val}</span> },
    { key: 'Symbol', label: 'Symbol', width: 80, sortable: true, render: (val) => <span className="text-semantic-text-subtle">{val || '-'}</span> },
    { key: 'DecimalPlaces', label: 'Decimals', width: 80, sortable: true, render: (val) => <span className="text-semantic-text-faint">{val ?? 2}</span> },
    {
      key: 'IsDefault',
      label: 'Default',
      width: 120,
      sortable: true,
      render: (val, row) =>
        val ? (
          <StatusBadge status="info" label="Default" size="sm" />
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setDefaultMutation.mutate(row.Id); }}
            className="text-xs text-semantic-text-faint hover:text-primary transition-colors"
          >
            Set Default
          </button>
        ),
    },
    {
      key: 'IsActive',
      label: 'Status',
      width: 80,
      sortable: true,
      render: (val) => <StatusBadge status={val ? 'success' : 'neutral'} label={val ? 'Active' : 'Inactive'} size="sm" />,
    },
    {
      key: 'Id',
      label: 'Actions',
      width: 100,
      sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openEditCurrency(row)} className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover transition-colors" title="Edit">
            <Edit className="w-4 h-4" />
          </button>
          {!row.IsDefault && (
            <button type="button" onClick={() => deleteModal.open(row)} className="p-1.5 text-semantic-text-faint hover:text-danger rounded hover:bg-interactive-hover transition-colors" title="Delete">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const rateColumns: ColumnDef<ExchangeRate>[] = [
    {
      key: 'ToCurrency',
      label: 'Currency',
      width: 100,
      sortable: true,
      render: (val) => <code className="text-xs bg-info/10 text-info px-1.5 py-0.5 rounded">{val}</code>,
    },
    { key: 'CurrencyName', label: 'Name', sortable: true, render: (val) => <span className="text-semantic-text-subtle">{val || '-'}</span> },
    {
      key: 'Rate',
      label: 'Rate',
      width: 120,
      sortable: true,
      render: (val) => <span className="font-mono text-semantic-text-default">{parseFloat(val).toFixed(6)}</span>,
    },
    { key: 'RateDate', label: 'Date', width: 120, sortable: true, render: (val) => <span className="text-semantic-text-faint">{val || '-'}</span> },
    {
      key: 'Source',
      label: 'Source',
      width: 80,
      sortable: true,
      render: (val) => <StatusBadge status={val === 'manual' ? 'info' : 'success'} label={val === 'manual' ? 'Manual' : 'Auto'} size="sm" />,
    },
    {
      key: 'Id',
      label: 'Actions',
      width: 100,
      sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openEditRate(row)} className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover transition-colors" title="Edit">
            <Edit className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => deleteRateModal.open(row)} className="p-1.5 text-semantic-text-faint hover:text-danger rounded hover:bg-interactive-hover transition-colors" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  // ---- Render ----

  if (currenciesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Currencies"
        description="Manage currency settings"
      />

      {/* Sub-tabs for currencies sections */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Currencies Tab */}
      {activeTab === 'currencies' && (
        <TableCard
          title="All Currencies"
          icon={<Coins className="w-4 h-4" />}
          count={currencies.length}
          headerActions={
            <Button icon={<Plus className="w-4 h-4" />} onClick={openCreateCurrency}>Add Currency</Button>
          }
        >
          <DataTable<Currency>
            id="admin-currencies"
            columns={currencyColumns}
            data={currencies}
            rowKey="Id"
            onRowClick={openEditCurrency}
            emptyMessage="No currencies configured"
            emptyIcon={Coins}
            embedded
            showColumnPicker={false}
          />
        </TableCard>
      )}

      {/* Provider Tab */}
      {activeTab === 'provider' && (
        <div className="space-y-4">
          <form id="provider-config-form" onSubmit={(e) => { e.preventDefault(); handleSaveProvider(); }}>
          <div className="rounded-lg border border-border bg-surface-raised p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-semantic-text-secondary">Exchange Rate Provider</h2>
              <Link
                to="/providers"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary hover:text-primary-600 border border-primary/30 hover:border-primary rounded-lg transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Manage Providers
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Provider">
                <select
                  value={selectedProviderId}
                  onChange={(e) => setSelectedProviderId(e.target.value)}
                  className="form-input"
                  title="Select exchange rate provider"
                >
                  <option value="">-- Select a provider --</option>
                  {unifiedProviders.map((p) => (
                    <option key={p.ProviderId} value={p.ProviderId}>{p.Name}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Base Currency">
                <input
                  type="text"
                  value={providerConfig?.baseCurrency || '-'}
                  className="form-input bg-surface-subtle cursor-not-allowed"
                  readOnly
                  tabIndex={-1}
                />
              </FormField>
            </div>
            <FormField label="API URL">
              <input
                type="text"
                value={providerConfig?.apiUrl || '-'}
                className="form-input bg-surface-subtle cursor-not-allowed"
                readOnly
                tabIndex={-1}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Fetch Schedule">
                <input
                  type="text"
                  value={providerConfig?.fetchSchedule === 'manual' ? 'Manual only' :
                         providerConfig?.fetchSchedule === 'hourly' ? 'Hourly' :
                         providerConfig?.fetchSchedule === 'daily' ? 'Daily' : '-'}
                  className="form-input bg-surface-subtle cursor-not-allowed"
                  readOnly
                  tabIndex={-1}
                />
              </FormField>
              {providerConfig?.fetchSchedule !== 'manual' && (
                <FormField label="Fetch Time">
                  <input
                    type="text"
                    value={providerConfig?.fetchTime || '-'}
                    className="form-input bg-surface-subtle cursor-not-allowed"
                    readOnly
                    tabIndex={-1}
                  />
                </FormField>
              )}
            </div>
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={providerForm.IsEnabled !== false}
                  onChange={(e) => setProviderForm({ ...providerForm, IsEnabled: e.target.checked })}
                  className="sr-only peer"
                  title="Enabled"
                />
                <div className="w-9 h-5 bg-surface-subtle peer-focus:ring-2 peer-focus:ring-interactive-focus-ring rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-semantic-text-faint after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-primary peer-checked:after:bg-semantic-text-on-primary" />
              </label>
              <span className="text-sm text-semantic-text-secondary">Enabled</span>
            </div>
            {/* Last fetch status */}
            {provider?.LastFetchedAt && (
              <div className="text-xs text-semantic-text-faint">
                Last fetched: {new Date(provider.LastFetchedAt).toLocaleString()}
                {provider.LastFetchStatus === 'error' ? (
                  <span className="ml-2"><StatusBadge status="danger" label="Error" size="sm" /></span>
                ) : (
                  <span className="ml-2"><StatusBadge status="success" label="Success" size="sm" /></span>
                )}
                {provider.LastFetchError && (
                  <div className="text-danger mt-1">{provider.LastFetchError}</div>
                )}
              </div>
            )}
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" loading={saveProviderMutation.isPending}>
                Save Settings
              </Button>
              <Button
                type="button"
                variant="secondary"
                icon={<RefreshCw className="w-4 h-4" />}
                onClick={() => fetchRatesMutation.mutate()}
                loading={fetchRatesMutation.isPending}
              >
                Fetch Latest Rates
              </Button>
            </div>
          </div>
          </form>
        </div>
      )}

      {/* Rates Tab */}
      {activeTab === 'rates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FormField label="Date">
                <input
                  type="date"
                  value={rateDate}
                  onChange={(e) => setRateDate(e.target.value)}
                  className="form-input w-48"
                  title="Rate date"
                />
              </FormField>
              {rates.length > 0 && rates[0].BaseCurrency && (
                <span className="text-sm text-semantic-text-faint mt-5">
                  Base: <strong className="text-semantic-text-secondary">{rates[0].BaseCurrency}</strong>
                  {rates[0].BaseCurrencyName && ` -- ${rates[0].BaseCurrencyName}`}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-5">
              <Button
                variant="secondary"
                icon={<RefreshCw className="w-4 h-4" />}
                onClick={() => fetchRatesMutation.mutate()}
                loading={fetchRatesMutation.isPending}
              >
                Fetch Latest
              </Button>
              <Button icon={<Plus className="w-4 h-4" />} onClick={openCreateRate}>
                Add Rate
              </Button>
            </div>
          </div>
          {ratesLoading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : (
            <TableCard
              title="Exchange Rates"
              icon={<Coins className="w-4 h-4" />}
              count={rates.length}
            >
              <DataTable<ExchangeRate>
                id="admin-exchange-rates"
                columns={rateColumns}
                data={rates}
                rowKey="Id"
                onRowClick={openEditRate}
                emptyMessage="No exchange rates for this date"
                emptyIcon={Coins}
                embedded
                showColumnPicker={false}
              />
            </TableCard>
          )}
        </div>
      )}

      {/* Create/Edit Currency Modal */}
      <Modal
        isOpen={currencyModal.isOpen}
        onClose={currencyModal.close}
        title={isEditingCurrency ? 'Edit Currency' : 'Add Currency'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={currencyModal.close}>Cancel</Button>
            <Button onClick={handleSaveCurrency} loading={createCurrencyMutation.isPending || updateCurrencyMutation.isPending}>
              {isEditingCurrency ? 'Save Changes' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Code (ISO 4217)" required>
              <input
                type="text"
                value={currencyForm.code}
                onChange={(e) => setCurrencyForm({ ...currencyForm, code: e.target.value.toUpperCase() })}
                className="form-input"
                placeholder="AUD"
                maxLength={3}
                disabled={isEditingCurrency}
              />
            </FormField>
            <FormField label="Symbol" required>
              <input
                type="text"
                value={currencyForm.symbol}
                onChange={(e) => setCurrencyForm({ ...currencyForm, symbol: e.target.value })}
                className="form-input"
                placeholder="$"
              />
            </FormField>
          </div>
          <FormField label="Name" required>
            <input
              type="text"
              value={currencyForm.name}
              onChange={(e) => setCurrencyForm({ ...currencyForm, name: e.target.value })}
              className="form-input"
              placeholder="Australian Dollar"
            />
          </FormField>
          <FormField label="Decimal Places">
            <input
              type="number"
              value={currencyForm.decimalPlaces}
              onChange={(e) => setCurrencyForm({ ...currencyForm, decimalPlaces: parseInt(e.target.value) || 2 })}
              className="form-input"
              title="Decimal places"
              min={0}
              max={6}
            />
          </FormField>
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={currencyForm.isDefault}
                onChange={(e) => setCurrencyForm({ ...currencyForm, isDefault: e.target.checked })}
                className="sr-only peer"
                title="Default"
              />
              <div className="w-9 h-5 bg-surface-subtle peer-focus:ring-2 peer-focus:ring-interactive-focus-ring rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-semantic-text-faint after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-primary peer-checked:after:bg-semantic-text-on-primary" />
            </label>
            <span className="text-sm text-semantic-text-secondary">Set as default</span>
          </div>
        </div>
      </Modal>

      {/* Delete Currency Modal */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.close}
        title="Delete Currency"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={deleteModal.close}>Cancel</Button>
            <Button variant="danger" onClick={() => deleteModal.data && deleteCurrencyMutation.mutate(deleteModal.data.Id)} loading={deleteCurrencyMutation.isPending}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-semantic-text-subtle">
          Are you sure you want to delete <strong className="text-semantic-text-default">{deleteModal.data?.Code}</strong> ({deleteModal.data?.Name})?
        </p>
      </Modal>

      {/* Create/Edit Rate Modal */}
      <Modal
        isOpen={rateModal.isOpen}
        onClose={rateModal.close}
        title={isEditingRate ? 'Edit Exchange Rate' : 'Add Exchange Rate'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={rateModal.close}>Cancel</Button>
            <Button onClick={handleSaveRate} loading={createRateMutation.isPending || updateRateMutation.isPending}>
              {isEditingRate ? 'Save Changes' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="To Currency" required>
            <select
              value={rateForm.toCurrency}
              onChange={(e) => setRateForm({ ...rateForm, toCurrency: e.target.value })}
              className="form-input"
              title="Target currency"
            >
              <option value="">Select currency</option>
              {currencies.filter((c) => c.IsActive).map((c) => (
                <option key={c.Code} value={c.Code}>{c.Code} -- {c.Name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Rate" required>
            <input
              type="number"
              value={rateForm.rate}
              onChange={(e) => setRateForm({ ...rateForm, rate: e.target.value })}
              className="form-input"
              placeholder="1.000000"
              step="0.000001"
              min="0"
            />
          </FormField>
          <FormField label="Date">
            <input
              type="date"
              value={rateForm.rateDate}
              onChange={(e) => setRateForm({ ...rateForm, rateDate: e.target.value })}
              className="form-input"
              title="Rate date"
            />
          </FormField>
        </div>
      </Modal>

      {/* Delete Rate Modal */}
      <Modal
        isOpen={deleteRateModal.isOpen}
        onClose={deleteRateModal.close}
        title="Delete Exchange Rate"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={deleteRateModal.close}>Cancel</Button>
            <Button variant="danger" onClick={() => deleteRateModal.data && deleteRateMutation.mutate(deleteRateModal.data.Id)} loading={deleteRateMutation.isPending}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-semantic-text-subtle">
          Delete the <strong className="text-semantic-text-default">{deleteRateModal.data?.ToCurrency}</strong> rate for {deleteRateModal.data?.RateDate}?
        </p>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FormField (local helper)
// ---------------------------------------------------------------------------

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-semantic-text-subtle mb-1">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
