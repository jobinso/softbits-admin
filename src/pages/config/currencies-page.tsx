import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Coins, Plus, Edit, Trash2 } from 'lucide-react';
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
  createCurrency,
  updateCurrency,
  deleteCurrency,
  setDefaultCurrency,
} from '@/services/admin-service';
import { useModal } from '@shared/hooks';
import type { Currency } from '@/types';

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

const INITIAL_CURRENCY_FORM: CurrencyForm = { code: '', name: '', symbol: '', decimalPlaces: 2, isDefault: false };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CurrenciesPage() {
  const queryClient = useQueryClient();
  const currencyModal = useModal<Currency>();
  const deleteModal = useModal<Currency>();
  const [currencyForm, setCurrencyForm] = useState<CurrencyForm>(INITIAL_CURRENCY_FORM);
  const [isEditingCurrency, setIsEditingCurrency] = useState(false);
  const [editingCurrencyId, setEditingCurrencyId] = useState<string | null>(null);

  // ---- Data fetching ----

  const { data: currenciesResponse, isLoading: currenciesLoading } = useQuery({
    queryKey: ['admin', 'currencies'],
    queryFn: getCurrencies,
  });

  const currencies: Currency[] = currenciesResponse?.data ?? [];

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
