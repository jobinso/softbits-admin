import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Coins, Plus, Edit, Trash2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DataTable,
  Button,
  Modal,
  StatusBadge,
  LoadingSpinner,
  Tabs,
  PageHeader,
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
} from '@/services/admin-service';
import { useModal } from '@shared/hooks';
import type { Currency, ExchangeRateProvider, ExchangeRate } from '@/types';

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
  const [providerApiKey, setProviderApiKey] = useState('');

  // ---- Tabs ----
  const tabs: TabItem[] = [
    { id: 'currencies', label: 'Currencies' },
    { id: 'provider', label: 'Exchange Provider' },
    { id: 'rates', label: 'Exchange Rates' },
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
    const data: Partial<ExchangeRateProvider> = {
      ...providerForm,
    };
    if (providerApiKey) data.ApiKey = providerApiKey;
    saveProviderMutation.mutate(data);
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
  if (provider && !providerForm.Name && !providerForm.ApiUrl) {
    setProviderForm({
      Name: provider.Name || '',
      ApiUrl: provider.ApiUrl || '',
      BaseCurrency: provider.BaseCurrency || 'AUD',
      FetchSchedule: provider.FetchSchedule || 'daily',
      FetchTime: provider.FetchTime || '05:00',
      IsEnabled: provider.IsEnabled !== false,
    });
  }

  // ---- Column definitions ----

  const currencyColumns: ColumnDef<Currency>[] = [
    {
      key: 'Code',
      label: 'Code',
      width: 100,
      sortable: true,
      render: (val) => <code className="text-xs bg-info/10 text-info px-1.5 py-0.5 rounded font-semibold">{val}</code>,
    },
    { key: 'Name', label: 'Name', sortable: true, render: (val) => <span className="text-dark-700">{val}</span> },
    { key: 'Symbol', label: 'Symbol', width: 80, sortable: true, render: (val) => <span className="text-dark-500">{val || '-'}</span> },
    { key: 'DecimalPlaces', label: 'Decimals', width: 80, sortable: true, render: (val) => <span className="text-dark-400">{val ?? 2}</span> },
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
            className="text-xs text-dark-400 hover:text-primary transition-colors"
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
          <button type="button" onClick={() => openEditCurrency(row)} className="p-1.5 text-dark-400 hover:text-primary rounded hover:bg-dark-100 transition-colors" title="Edit">
            <Edit className="w-4 h-4" />
          </button>
          {!row.IsDefault && (
            <button type="button" onClick={() => deleteModal.open(row)} className="p-1.5 text-dark-400 hover:text-danger rounded hover:bg-dark-100 transition-colors" title="Delete">
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
    { key: 'CurrencyName', label: 'Name', sortable: true, render: (val) => <span className="text-dark-500">{val || '-'}</span> },
    {
      key: 'Rate',
      label: 'Rate',
      width: 120,
      sortable: true,
      render: (val) => <span className="font-mono text-dark-700">{parseFloat(val).toFixed(6)}</span>,
    },
    { key: 'RateDate', label: 'Date', width: 120, sortable: true, render: (val) => <span className="text-dark-400">{val || '-'}</span> },
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
          <button type="button" onClick={() => openEditRate(row)} className="p-1.5 text-dark-400 hover:text-primary rounded hover:bg-dark-100 transition-colors" title="Edit">
            <Edit className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => deleteRateModal.open(row)} className="p-1.5 text-dark-400 hover:text-danger rounded hover:bg-dark-100 transition-colors" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  // ---- Render ----

  if (currenciesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Currencies & Exchange Rates"
        description="Manage supported currencies and exchange rate providers"
        icon={<Coins className="w-5 h-5" />}
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Currencies Tab */}
      {activeTab === 'currencies' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-dark-400">{currencies.length} currencies</span>
            <Button icon={<Plus className="w-4 h-4" />} onClick={openCreateCurrency}>Add Currency</Button>
          </div>
          <DataTable<Currency>
            id="admin-currencies"
            columns={currencyColumns}
            data={currencies}
            rowKey="Id"
            onRowClick={openEditCurrency}
            emptyMessage="No currencies configured"
            emptyIcon={Coins}
          />
        </div>
      )}

      {/* Provider Tab */}
      {activeTab === 'provider' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-dark-200 bg-dark-50 p-6 space-y-4">
            <h2 className="text-sm font-medium text-dark-600">Exchange Rate Provider</h2>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Provider Name">
                <input
                  type="text"
                  value={providerForm.Name || ''}
                  onChange={(e) => setProviderForm({ ...providerForm, Name: e.target.value })}
                  className="form-input"
                  placeholder="e.g. Exchange Rates API"
                />
              </FormField>
              <FormField label="Base Currency">
                <select
                  value={providerForm.BaseCurrency || 'AUD'}
                  onChange={(e) => setProviderForm({ ...providerForm, BaseCurrency: e.target.value })}
                  className="form-input"
                  title="Base currency"
                >
                  {currencies.filter((c) => c.IsActive).map((c) => (
                    <option key={c.Code} value={c.Code}>{c.Code} -- {c.Name}</option>
                  ))}
                  {currencies.length === 0 && ['AUD', 'USD', 'EUR', 'GBP', 'ZAR'].map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </FormField>
            </div>
            <FormField label="API URL">
              <input
                type="text"
                value={providerForm.ApiUrl || ''}
                onChange={(e) => setProviderForm({ ...providerForm, ApiUrl: e.target.value })}
                className="form-input"
                placeholder="https://api.exchangeratesapi.io/..."
              />
            </FormField>
            <FormField label="API Key">
              <input
                type="password"
                value={providerApiKey}
                onChange={(e) => setProviderApiKey(e.target.value)}
                className="form-input"
                placeholder={provider?.ApiKey ? 'Leave blank to keep existing key' : 'Enter API key (optional)'}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Fetch Schedule">
                <select
                  value={providerForm.FetchSchedule || 'daily'}
                  onChange={(e) => setProviderForm({ ...providerForm, FetchSchedule: e.target.value })}
                  className="form-input"
                  title="Fetch schedule"
                >
                  <option value="manual">Manual only</option>
                  <option value="daily">Daily</option>
                  <option value="hourly">Hourly</option>
                </select>
              </FormField>
              {providerForm.FetchSchedule !== 'manual' && (
                <FormField label="Fetch Time">
                  <input
                    type="time"
                    value={providerForm.FetchTime || '05:00'}
                    onChange={(e) => setProviderForm({ ...providerForm, FetchTime: e.target.value })}
                    className="form-input"
                    title="Fetch time"
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
                <div className="w-9 h-5 bg-dark-200 peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-dark-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary peer-checked:after:bg-dark" />
              </label>
              <span className="text-sm text-dark-600">Enabled</span>
            </div>
            {/* Last fetch status */}
            {provider?.LastFetchedAt && (
              <div className="text-xs text-dark-400">
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
              <Button onClick={handleSaveProvider} loading={saveProviderMutation.isPending}>
                Save Settings
              </Button>
              <Button
                variant="secondary"
                icon={<RefreshCw className="w-4 h-4" />}
                onClick={() => fetchRatesMutation.mutate()}
                loading={fetchRatesMutation.isPending}
              >
                Fetch Latest Rates
              </Button>
            </div>
          </div>
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
                <span className="text-sm text-dark-400 mt-5">
                  Base: <strong className="text-dark-600">{rates[0].BaseCurrency}</strong>
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
            <DataTable<ExchangeRate>
              id="admin-exchange-rates"
              columns={rateColumns}
              data={rates}
              rowKey="Id"
              onRowClick={openEditRate}
              emptyMessage="No exchange rates for this date"
              emptyIcon={Coins}
            />
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
              <div className="w-9 h-5 bg-dark-200 peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-dark-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary peer-checked:after:bg-dark" />
            </label>
            <span className="text-sm text-dark-600">Set as default</span>
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
        <p className="text-sm text-dark-500">
          Are you sure you want to delete <strong className="text-dark-700">{deleteModal.data?.Code}</strong> ({deleteModal.data?.Name})?
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
        <p className="text-sm text-dark-500">
          Delete the <strong className="text-dark-700">{deleteRateModal.data?.ToCurrency}</strong> rate for {deleteRateModal.data?.RateDate}?
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
      <label className="block text-xs font-medium text-dark-500 mb-1">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
