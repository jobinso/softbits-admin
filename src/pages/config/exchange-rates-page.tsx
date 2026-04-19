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
  TableCard,
} from '@/components/shared';
import type { ColumnDef } from '@/components/shared';
import {
  getCurrencies,
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

interface RateForm {
  toCurrency: string;
  rate: string;
  rateDate: string;
}

const INITIAL_RATE_FORM: RateForm = { toCurrency: '', rate: '', rateDate: new Date().toISOString().split('T')[0] };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ExchangeRatesPage() {
  const queryClient = useQueryClient();
  const [rateDate, setRateDate] = useState(new Date().toISOString().split('T')[0]);
  const rateModal = useModal<ExchangeRate>();
  const deleteRateModal = useModal<ExchangeRate>();
  const [rateForm, setRateForm] = useState<RateForm>(INITIAL_RATE_FORM);
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [editingRateId, setEditingRateId] = useState<string | null>(null);

  // ---- Provider form state ----
  const [providerForm, setProviderForm] = useState<Partial<ExchangeRateProvider>>({});
  const [selectedProviderId, setSelectedProviderId] = useState('');

  // ---- Data fetching ----

  const { data: currenciesResponse } = useQuery({
    queryKey: ['admin', 'currencies'],
    queryFn: getCurrencies,
  });

  const currencies: Currency[] = currenciesResponse?.data ?? [];

  const { data: providerResponse } = useQuery({
    queryKey: ['admin', 'exchange-rate-provider'],
    queryFn: getExchangeRateProvider,
  });

  const provider = providerResponse?.data;

  const { data: unifiedProvidersResponse } = useQuery({
    queryKey: ['admin', 'providers', 'EXCHANGE_RATE_API'],
    queryFn: () => getProvidersByType('EXCHANGE_RATE_API'),
  });

  const unifiedProviders: Provider[] = unifiedProvidersResponse?.data ?? [];

  const { data: ratesResponse, isLoading: ratesLoading } = useQuery({
    queryKey: ['admin', 'exchange-rates', rateDate],
    queryFn: () => getExchangeRates(rateDate),
  });

  const rates: ExchangeRate[] = ratesResponse?.data ?? [];

  // ---- Mutations ----

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
    if (!selectedProviderId && unifiedProviders.length > 0) {
      const match = unifiedProviders.find(p => p.Name === provider.Name);
      if (match) setSelectedProviderId(match.ProviderId);
    }
  }

  // ---- Derive read-only config from selected unified provider ----
  const selectedProvider = unifiedProviders.find(p => p.ProviderId === selectedProviderId) || null;
  const providerConfig = selectedProvider?.Configuration as Record<string, string> | null;

  // ---- Column definitions ----

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

  return (
    <div className="space-y-6">
      {/* Provider Settings -- compact */}
      <form onSubmit={(e) => { e.preventDefault(); handleSaveProvider(); }}>
        <div className="rounded-lg border border-border bg-surface-raised p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-semantic-text-secondary">Provider Settings</h3>
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" loading={saveProviderMutation.isPending}>
                Save
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                onClick={() => fetchRatesMutation.mutate()}
                loading={fetchRatesMutation.isPending}
              >
                Fetch Rates
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 items-end">
            <FormField label="Provider">
              <select
                value={selectedProviderId}
                onChange={(e) => setSelectedProviderId(e.target.value)}
                className="form-input"
                title="Select exchange rate provider"
              >
                <option value="">-- Select --</option>
                {unifiedProviders.map((p) => (
                  <option key={p.ProviderId} value={p.ProviderId}>{p.Name}</option>
                ))}
              </select>
            </FormField>
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
            {providerConfig?.fetchSchedule !== 'manual' ? (
              <FormField label="Fetch Time">
                <input
                  type="text"
                  value={providerConfig?.fetchTime || '-'}
                  className="form-input bg-surface-subtle cursor-not-allowed"
                  readOnly
                  tabIndex={-1}
                />
              </FormField>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-3 pb-1">
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
          </div>
        </div>
      </form>

      {/* Exchange Rates Section */}
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
