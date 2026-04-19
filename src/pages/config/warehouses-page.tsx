import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Warehouse as WarehouseIcon, Plus, Edit, Link2, Unlink, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DataTable,
  Button,
  Modal,
  StatusBadge,
  LoadingSpinner,
  SearchInput,
} from '@/components/shared';
import type { ColumnDef } from '@/components/shared';
import {
  getWarehouses,
  getWarehouse,
  createWarehouse,
  updateWarehouse,
  deactivateWarehouse,
  getWarehouseErpLinks,
  linkErpWarehouse,
  unlinkErpWarehouse,
  getErpWarehouseBrowse,
} from '@/services/admin-service';
import { useModal } from '@shared/hooks';
import type { Warehouse, WarehouseErpLink, ErpWarehouseBrowse } from '@/types';

// ---------------------------------------------------------------------------
// Form types
// ---------------------------------------------------------------------------

interface WarehouseForm {
  warehouseCode: string;
  warehouseName: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  notes: string;
  status: string;
}

const INITIAL_FORM: WarehouseForm = {
  warehouseCode: '', warehouseName: '', address: '', city: '',
  state: '', postalCode: '', country: '', notes: '', status: 'Active',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WarehousesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const warehouseModal = useModal<Warehouse>();
  const deactivateModal = useModal<Warehouse>();
  const erpLinksModal = useModal<Warehouse>();
  const [form, setForm] = useState<WarehouseForm>(INITIAL_FORM);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // ---- ERP links state ----
  const [erpLinks, setErpLinks] = useState<WarehouseErpLink[]>([]);
  const [erpLinksLoading, setErpLinksLoading] = useState(false);
  const [erpBrowseData, setErpBrowseData] = useState<ErpWarehouseBrowse[]>([]);
  const [selectedErpCode, setSelectedErpCode] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualName, setManualName] = useState('');

  // ---- Data fetching ----

  const { data: warehousesResponse, isLoading } = useQuery({
    queryKey: ['admin', 'warehouses'],
    queryFn: getWarehouses,
  });

  const warehouses: Warehouse[] = warehousesResponse?.data ?? [];

  const filteredWarehouses = search
    ? warehouses.filter((w) => {
        const s = search.toLowerCase();
        return (
          w.WarehouseCode.toLowerCase().includes(s) ||
          w.WarehouseName.toLowerCase().includes(s) ||
          (w.City && w.City.toLowerCase().includes(s))
        );
      })
    : warehouses;

  // ---- Mutations ----

  const createMutation = useMutation({
    mutationFn: (data: Partial<Warehouse>) => createWarehouse(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'warehouses'] });
      warehouseModal.close();
      toast.success('Warehouse created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create warehouse'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Warehouse> }) => updateWarehouse(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'warehouses'] });
      warehouseModal.close();
      toast.success('Warehouse updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update warehouse'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateWarehouse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'warehouses'] });
      deactivateModal.close();
      toast.success('Warehouse deactivated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to deactivate warehouse'),
  });

  const linkMutation = useMutation({
    mutationFn: ({ warehouseId, data }: { warehouseId: string; data: { erpWarehouseCode: string; erpWarehouseName?: string } }) =>
      linkErpWarehouse(warehouseId, data),
    onSuccess: () => {
      if (erpLinksModal.data) loadErpLinks(erpLinksModal.data.WarehouseId);
      queryClient.invalidateQueries({ queryKey: ['admin', 'warehouses'] });
      setSelectedErpCode('');
      setManualCode('');
      setManualName('');
      toast.success('ERP warehouse linked');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to link ERP warehouse'),
  });

  const unlinkMutation = useMutation({
    mutationFn: ({ warehouseId, linkId }: { warehouseId: string; linkId: string }) =>
      unlinkErpWarehouse(warehouseId, linkId),
    onSuccess: () => {
      if (erpLinksModal.data) loadErpLinks(erpLinksModal.data.WarehouseId);
      queryClient.invalidateQueries({ queryKey: ['admin', 'warehouses'] });
      toast.success('ERP warehouse unlinked');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to unlink ERP warehouse'),
  });

  // ---- Handlers ----

  function openCreate() {
    setForm(INITIAL_FORM);
    setIsEditing(false);
    setEditingId(null);
    warehouseModal.open();
  }

  async function openEdit(w: Warehouse) {
    try {
      const result = await getWarehouse(w.WarehouseId);
      const wh = result.data;
      setForm({
        warehouseCode: wh.WarehouseCode || '',
        warehouseName: wh.WarehouseName || '',
        address: wh.Address || '',
        city: wh.City || '',
        state: wh.State || '',
        postalCode: wh.PostalCode || '',
        country: wh.Country || '',
        notes: wh.Notes || '',
        status: wh.Status || 'Active',
      });
      setIsEditing(true);
      setEditingId(wh.WarehouseId);
      warehouseModal.open(w);
    } catch {
      toast.error('Failed to load warehouse details');
    }
  }

  function handleSave() {
    if (!form.warehouseCode.trim()) { toast.error('Warehouse Code is required'); return; }
    if (!form.warehouseName.trim()) { toast.error('Warehouse Name is required'); return; }
    if (isEditing && editingId) {
      updateMutation.mutate({ id: editingId, data: form as unknown as Partial<Warehouse> });
    } else {
      createMutation.mutate(form as unknown as Partial<Warehouse>);
    }
  }

  async function openErpLinks(w: Warehouse) {
    erpLinksModal.open(w);
    setManualMode(false);
    setSelectedErpCode('');
    setManualCode('');
    setManualName('');
    loadErpLinks(w.WarehouseId);
    loadErpBrowse();
  }

  async function loadErpLinks(warehouseId: string) {
    setErpLinksLoading(true);
    try {
      const result = await getWarehouseErpLinks(warehouseId);
      setErpLinks(result.data || []);
    } catch {
      toast.error('Failed to load ERP links');
    } finally {
      setErpLinksLoading(false);
    }
  }

  async function loadErpBrowse() {
    try {
      const result = await getErpWarehouseBrowse();
      setErpBrowseData(result.data || []);
      if (!result.data || result.data.length === 0) setManualMode(true);
    } catch {
      setManualMode(true);
    }
  }

  function handleLinkFromPicker() {
    if (!selectedErpCode || !erpLinksModal.data) { toast.error('Select an ERP warehouse'); return; }
    const selected = erpBrowseData.find((w) => w.Warehouse === selectedErpCode);
    linkMutation.mutate({
      warehouseId: erpLinksModal.data.WarehouseId,
      data: { erpWarehouseCode: selectedErpCode, erpWarehouseName: selected?.Description || undefined },
    });
  }

  function handleLinkManual() {
    if (!manualCode.trim() || !erpLinksModal.data) { toast.error('ERP Warehouse Code is required'); return; }
    linkMutation.mutate({
      warehouseId: erpLinksModal.data.WarehouseId,
      data: { erpWarehouseCode: manualCode.trim(), erpWarehouseName: manualName.trim() || undefined },
    });
  }

  // ---- Column definitions ----

  const columns: ColumnDef<Warehouse>[] = [
    {
      key: 'WarehouseCode',
      label: 'Code',
      width: 120,
      sortable: true,
      filterable: true,
      render: (val) => <span className="font-semibold text-dark-700">{val}</span>,
    },
    {
      key: 'WarehouseName',
      label: 'Name',
      sortable: true,
      filterable: true,
      render: (val) => <span className="text-dark-600">{val}</span>,
    },
    {
      key: 'City',
      label: 'Location',
      width: 200,
      sortable: true,
      render: (_val, row) => {
        const parts = [row.City, row.State, row.Country].filter(Boolean);
        return <span className="text-dark-400">{parts.length > 0 ? parts.join(', ') : '-'}</span>;
      },
    },
    {
      key: 'ErpLinkCount',
      label: 'ERP Links',
      width: 100,
      sortable: true,
      render: (val) => {
        const count = val || 0;
        return <span className="text-dark-400">{count} link{count !== 1 ? 's' : ''}</span>;
      },
    },
    {
      key: 'Status',
      label: 'Status',
      width: 100,
      sortable: true,
      filterable: true,
      filterType: 'select',
      filterOptions: [
        { value: 'Active', label: 'Active' },
        { value: 'Inactive', label: 'Inactive' },
      ],
      render: (val) => (
        <StatusBadge
          status={val === 'Active' ? 'success' : 'neutral'}
          label={val || 'Unknown'}
          size="sm"
        />
      ),
    },
    {
      key: 'WarehouseId',
      label: 'Actions',
      width: 140,
      sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openEdit(row)} className="p-1.5 text-dark-400 hover:text-primary rounded hover:bg-dark-100 transition-colors" title="Edit">
            <Edit className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => openErpLinks(row)} className="p-1.5 text-dark-400 hover:text-primary rounded hover:bg-dark-100 transition-colors" title="ERP Links">
            <Link2 className="w-4 h-4" />
          </button>
          {row.Status === 'Active' && (
            <button type="button" onClick={() => deactivateModal.open(row)} className="p-1.5 text-dark-400 hover:text-danger rounded hover:bg-dark-100 transition-colors" title="Deactivate">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  // ---- Render ----

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <WarehouseIcon className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold text-dark-700">Warehouses</h1>
          <span className="text-sm text-dark-400">{warehouses.length} total</span>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>
          New Warehouse
        </Button>
      </div>

      {/* Search */}
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search warehouses by code, name, or city..."
        className="max-w-md"
      />

      {/* Table */}
      <DataTable<Warehouse>
        id="admin-warehouses"
        columns={columns}
        data={filteredWarehouses}
        rowKey="WarehouseId"
        onRowClick={openEdit}
        emptyMessage="No warehouses found"
        emptyIcon={WarehouseIcon}
        showFilters
      />

      {/* Create/Edit Warehouse Modal */}
      <Modal
        isOpen={warehouseModal.isOpen}
        onClose={warehouseModal.close}
        title={isEditing ? 'Edit Warehouse' : 'New Warehouse'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={warehouseModal.close}>Cancel</Button>
            <Button onClick={handleSave} loading={createMutation.isPending || updateMutation.isPending}>
              {isEditing ? 'Save Changes' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Warehouse Code" required>
              <input
                type="text"
                value={form.warehouseCode}
                onChange={(e) => setForm({ ...form, warehouseCode: e.target.value })}
                className="form-input"
                placeholder="e.g. WH-001"
              />
            </FormField>
            <FormField label="Warehouse Name" required>
              <input
                type="text"
                value={form.warehouseName}
                onChange={(e) => setForm({ ...form, warehouseName: e.target.value })}
                className="form-input"
                placeholder="Main Warehouse"
              />
            </FormField>
          </div>
          <FormField label="Address">
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="form-input"
              placeholder="Street address"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="City">
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="form-input"
                placeholder="City"
              />
            </FormField>
            <FormField label="State/Province">
              <input
                type="text"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="form-input"
                placeholder="State"
              />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Postal Code">
              <input
                type="text"
                value={form.postalCode}
                onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                className="form-input"
                placeholder="Postal code"
              />
            </FormField>
            <FormField label="Country">
              <input
                type="text"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="form-input"
                placeholder="Country"
              />
            </FormField>
          </div>
          <FormField label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="form-input"
              rows={2}
              placeholder="Optional notes"
            />
          </FormField>
          <FormField label="Status">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="form-input"
              title="Status"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </FormField>
        </div>
      </Modal>

      {/* Deactivate Modal */}
      <Modal
        isOpen={deactivateModal.isOpen}
        onClose={deactivateModal.close}
        title="Deactivate Warehouse"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={deactivateModal.close}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => deactivateModal.data && deactivateMutation.mutate(deactivateModal.data.WarehouseId)}
              loading={deactivateMutation.isPending}
            >
              Deactivate
            </Button>
          </>
        }
      >
        <p className="text-sm text-dark-500">
          Are you sure you want to deactivate <strong className="text-dark-700">{deactivateModal.data?.WarehouseCode}</strong> ({deactivateModal.data?.WarehouseName})?
        </p>
      </Modal>

      {/* ERP Links Modal */}
      <Modal
        isOpen={erpLinksModal.isOpen}
        onClose={erpLinksModal.close}
        title={`ERP Links: ${erpLinksModal.data?.WarehouseCode || ''}`}
        size="md"
      >
        <div className="space-y-4">
          {/* Existing links */}
          {erpLinksLoading ? (
            <div className="flex justify-center py-4"><LoadingSpinner /></div>
          ) : erpLinks.length === 0 ? (
            <div className="text-center text-dark-400 py-4 text-sm">No ERP warehouses linked</div>
          ) : (
            <div>
              <h4 className="text-xs font-medium text-dark-500 mb-2">
                Linked ERP Warehouses ({erpLinks.length})
              </h4>
              <div className="space-y-2">
                {erpLinks.map((link) => (
                  <div key={link.LinkId} className="flex items-center justify-between px-3 py-2.5 bg-dark-100 rounded-lg">
                    <div>
                      <span className="text-sm font-medium text-dark-700">{link.ErpWarehouseCode}</span>
                      {link.ErpWarehouseName && (
                        <span className="text-sm text-dark-400 ml-2">{link.ErpWarehouseName}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        erpLinksModal.data &&
                        unlinkMutation.mutate({ warehouseId: erpLinksModal.data.WarehouseId, linkId: link.LinkId })
                      }
                      className="p-1.5 text-dark-400 hover:text-danger rounded hover:bg-dark-200 transition-colors"
                      title="Unlink"
                    >
                      <Unlink className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-dark-200" />

          {/* Link new warehouse */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-dark-500">Link ERP Warehouse</h4>
              <button
                type="button"
                onClick={() => setManualMode(!manualMode)}
                className="text-xs text-primary hover:text-primary/80"
              >
                {manualMode ? 'Use picker' : 'Enter manually'}
              </button>
            </div>

            {!manualMode ? (
              <div className="flex items-center gap-2">
                <select
                  value={selectedErpCode}
                  onChange={(e) => setSelectedErpCode(e.target.value)}
                  className="form-input flex-1"
                  title="ERP warehouse"
                >
                  <option value="">-- Select ERP Warehouse --</option>
                  {erpBrowseData.map((w) => (
                    <option key={w.Warehouse} value={w.Warehouse}>
                      {w.Warehouse}{w.Description ? ` - ${w.Description}` : ''}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  onClick={handleLinkFromPicker}
                  loading={linkMutation.isPending}
                  disabled={!selectedErpCode}
                >
                  Link
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    className="form-input"
                    placeholder="ERP Warehouse Code"
                  />
                  <input
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="form-input"
                    placeholder="Name (optional)"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleLinkManual}
                  loading={linkMutation.isPending}
                  disabled={!manualCode.trim()}
                >
                  Link
                </Button>
              </div>
            )}
          </div>
        </div>
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
