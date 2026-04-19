import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DataTable,
  Button,
  Modal,
  StatusBadge,
  Card,
} from '@/components/shared';
import type { ColumnDef } from '@/components/shared';
import {
  getTerritories,
  createTerritory,
  updateTerritory,
  deleteTerritory as deleteTerritoryApi,
  getSalesReps,
  createSalesRep,
  updateSalesRep,
  deleteSalesRep as deleteSalesRepApi,
} from '@/services/admin-service';
import { useModal } from '@shared/hooks';
import type { Territory, SalesRep } from '@/types';

// ---------------------------------------------------------------------------
// Form types & defaults
// ---------------------------------------------------------------------------

interface TerritoryForm {
  name: string;
  code: string;
  sysproBranch: string;
  description: string;
  isActive: boolean;
}

interface SalesRepForm {
  name: string;
  email: string;
  phone: string;
  sysproSalesperson: string;
  salesTarget: number;
  defaultPipelineId: string;
  isActive: boolean;
}

const INITIAL_TERRITORY: TerritoryForm = { name: '', code: '', sysproBranch: '', description: '', isActive: true };
const INITIAL_SALESREP: SalesRepForm = { name: '', email: '', phone: '', sysproSalesperson: '', salesTarget: 0, defaultPipelineId: '', isActive: true };

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConnectTeamsTab() {
  const queryClient = useQueryClient();

  // ---- Modals ----
  const territoryModal = useModal<Territory>();
  const deleteTerritoryModal = useModal<Territory>();
  const salesRepModal = useModal<SalesRep>();
  const deleteSalesRepModal = useModal<SalesRep>();

  // ---- Form state ----
  const [territoryForm, setTerritoryForm] = useState<TerritoryForm>(INITIAL_TERRITORY);
  const [isEditTerritory, setIsEditTerritory] = useState(false);
  const [salesRepForm, setSalesRepForm] = useState<SalesRepForm>(INITIAL_SALESREP);
  const [isEditSalesRep, setIsEditSalesRep] = useState(false);

  // ---- Queries ----

  const { data: territoriesRes } = useQuery({
    queryKey: ['connect', 'territories'],
    queryFn: () => getTerritories({ withCounts: true }),
  });

  const { data: salesRepsRes } = useQuery({
    queryKey: ['connect', 'sales-reps'],
    queryFn: () => getSalesReps({ withCounts: true, withTerritories: true }),
  });

  const territories: Territory[] = territoriesRes?.data ?? [];
  const salesReps: SalesRep[] = salesRepsRes?.data ?? [];

  // ---- Mutations ----

  const saveTerritoryMut = useMutation({
    mutationFn: (args: { id?: string; data: Partial<Territory> }) =>
      args.id ? updateTerritory(args.id, args.data) : createTerritory(args.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'territories'] });
      territoryModal.close();
      toast.success(isEditTerritory ? 'Territory updated' : 'Territory created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save territory'),
  });

  const removeTerritoryMut = useMutation({
    mutationFn: (id: string) => deleteTerritoryApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'territories'] });
      deleteTerritoryModal.close();
      toast.success('Territory deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete territory'),
  });

  const saveSalesRepMut = useMutation({
    mutationFn: (args: { id?: string; data: Partial<SalesRep> }) =>
      args.id ? updateSalesRep(args.id, args.data) : createSalesRep(args.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'sales-reps'] });
      salesRepModal.close();
      toast.success(isEditSalesRep ? 'Sales rep updated' : 'Sales rep created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save sales rep'),
  });

  const removeSalesRepMut = useMutation({
    mutationFn: (id: string) => deleteSalesRepApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'sales-reps'] });
      deleteSalesRepModal.close();
      toast.success('Sales rep deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete sales rep'),
  });

  // ---- Handlers ----

  function openCreateTerritory() {
    setTerritoryForm(INITIAL_TERRITORY);
    setIsEditTerritory(false);
    territoryModal.open();
  }
  function openEditTerritory(t: Territory) {
    setTerritoryForm({ name: t.Name, code: t.Code || '', sysproBranch: t.SysproBranch || '', description: t.Description || '', isActive: t.IsActive });
    setIsEditTerritory(true);
    territoryModal.open(t);
  }
  function handleSaveTerritory() {
    if (!territoryForm.name.trim()) { toast.error('Name is required'); return; }
    saveTerritoryMut.mutate({
      id: isEditTerritory ? territoryModal.data?.Id : undefined,
      data: territoryForm,
    });
  }

  function openCreateSalesRep() {
    setSalesRepForm(INITIAL_SALESREP);
    setIsEditSalesRep(false);
    salesRepModal.open();
  }
  function openEditSalesRep(r: SalesRep) {
    setSalesRepForm({
      name: r.Name, email: r.Email || '', phone: r.Phone || '',
      sysproSalesperson: r.SysproSalesperson || '', salesTarget: r.SalesTarget || 0,
      defaultPipelineId: r.DefaultPipelineId || '', isActive: r.IsActive,
    });
    setIsEditSalesRep(true);
    salesRepModal.open(r);
  }
  function handleSaveSalesRep() {
    if (!salesRepForm.name.trim()) { toast.error('Name is required'); return; }
    saveSalesRepMut.mutate({
      id: isEditSalesRep ? salesRepModal.data?.Id : undefined,
      data: salesRepForm,
    });
  }

  // ---- Column definitions ----

  const territoryColumns: ColumnDef<Territory>[] = [
    { key: 'Name', label: 'Name', sortable: true, render: (v) => <span className="font-medium text-dark-700">{v}</span> },
    { key: 'Code', label: 'Code', width: 100, sortable: true, render: (v) => <code className="text-xs bg-dark-100 px-1.5 py-0.5 rounded">{v || '-'}</code> },
    { key: 'SysproBranch', label: 'ERP Branch', width: 120, sortable: true, render: (v) => v || '-' },
    { key: 'AccountCount', label: 'Accounts', width: 90, sortable: true, render: (v) => v ?? 0 },
    { key: 'IsActive', label: 'Status', width: 90, sortable: true, render: (v) => <StatusBadge status={v ? 'success' : 'neutral'} label={v ? 'Active' : 'Inactive'} size="sm" /> },
    {
      key: 'Id', label: 'Actions', width: 100, sortable: false,
      render: (_v, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openEditTerritory(row)} className="p-1.5 text-dark-400 hover:text-primary rounded hover:bg-dark-100" title="Edit"><Edit className="w-4 h-4" /></button>
          <button type="button" onClick={() => deleteTerritoryModal.open(row)} className="p-1.5 text-dark-400 hover:text-danger rounded hover:bg-dark-100" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  const salesRepColumns: ColumnDef<SalesRep>[] = [
    { key: 'Name', label: 'Name', sortable: true, render: (v) => <span className="font-medium text-dark-700">{v}</span> },
    { key: 'Email', label: 'Email', sortable: true, render: (v) => v || '-' },
    { key: 'SysproSalesperson', label: 'ERP Code', width: 100, sortable: true, render: (v) => v ? <code className="text-xs bg-dark-100 px-1.5 py-0.5 rounded">{v}</code> : '-' },
    { key: 'AccountCount', label: 'Accounts', width: 90, sortable: true, render: (v) => v ?? 0 },
    { key: 'IsActive', label: 'Status', width: 90, sortable: true, render: (v) => <StatusBadge status={v ? 'success' : 'neutral'} label={v ? 'Active' : 'Inactive'} size="sm" /> },
    {
      key: 'Id', label: 'Actions', width: 100, sortable: false,
      render: (_v, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openEditSalesRep(row)} className="p-1.5 text-dark-400 hover:text-primary rounded hover:bg-dark-100" title="Edit"><Edit className="w-4 h-4" /></button>
          <button type="button" onClick={() => deleteSalesRepModal.open(row)} className="p-1.5 text-dark-400 hover:text-danger rounded hover:bg-dark-100" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  // ---- Render ----

  return (
    <div className="space-y-6">
      {/* Territories */}
      <Card title={`Territories (${territories.length})`} headerAction={
        <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreateTerritory}>Add Territory</Button>
      }>
        <DataTable<Territory>
          id="connect-territories"
          columns={territoryColumns}
          data={territories}
          rowKey={(row) => row.Id}
          onRowClick={openEditTerritory}
          emptyMessage="No territories. Click Add Territory to create one."
        />
      </Card>

      {/* Sales Reps */}
      <Card title={`Sales Reps (${salesReps.length})`} headerAction={
        <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreateSalesRep}>Add Sales Rep</Button>
      }>
        <DataTable<SalesRep>
          id="connect-sales-reps"
          columns={salesRepColumns}
          data={salesReps}
          rowKey={(row) => row.Id}
          onRowClick={openEditSalesRep}
          emptyMessage="No sales reps. Click Add Sales Rep to create one."
        />
      </Card>

      {/* Territory Modal */}
      <Modal isOpen={territoryModal.isOpen} onClose={territoryModal.close} title={isEditTerritory ? 'Edit Territory' : 'Add Territory'} size="sm" footer={
        <><Button variant="secondary" onClick={territoryModal.close}>Cancel</Button>
        <Button onClick={handleSaveTerritory} loading={saveTerritoryMut.isPending}>{isEditTerritory ? 'Save Changes' : 'Create'}</Button></>
      }>
        <div className="space-y-4">
          <FormField label="Name" required><input type="text" value={territoryForm.name} onChange={(e) => setTerritoryForm({ ...territoryForm, name: e.target.value })} className="form-input" placeholder="e.g. Western Cape" /></FormField>
          <FormField label="Code"><input type="text" value={territoryForm.code} onChange={(e) => setTerritoryForm({ ...territoryForm, code: e.target.value })} className="form-input" placeholder="e.g. WC" /></FormField>
          <FormField label="ERP Branch"><input type="text" value={territoryForm.sysproBranch} onChange={(e) => setTerritoryForm({ ...territoryForm, sysproBranch: e.target.value })} className="form-input" /></FormField>
          <FormField label="Description"><textarea value={territoryForm.description} onChange={(e) => setTerritoryForm({ ...territoryForm, description: e.target.value })} className="form-input" rows={2} /></FormField>
          <label className="flex items-center gap-2 text-sm text-dark-600 cursor-pointer"><input type="checkbox" checked={territoryForm.isActive} onChange={(e) => setTerritoryForm({ ...territoryForm, isActive: e.target.checked })} className="w-4 h-4 rounded border-dark-300" />Active</label>
        </div>
      </Modal>

      {/* Delete Territory Modal */}
      <Modal isOpen={deleteTerritoryModal.isOpen} onClose={deleteTerritoryModal.close} title="Delete Territory" size="sm" footer={
        <><Button variant="secondary" onClick={deleteTerritoryModal.close}>Cancel</Button>
        <Button variant="danger" onClick={() => deleteTerritoryModal.data && removeTerritoryMut.mutate(deleteTerritoryModal.data.Id)} loading={removeTerritoryMut.isPending}>Delete</Button></>
      }>
        <p className="text-sm text-dark-500">Delete <strong className="text-dark-700">{deleteTerritoryModal.data?.Name}</strong>?</p>
      </Modal>

      {/* Sales Rep Modal */}
      <Modal isOpen={salesRepModal.isOpen} onClose={salesRepModal.close} title={isEditSalesRep ? 'Edit Sales Rep' : 'Add Sales Rep'} size="sm" footer={
        <><Button variant="secondary" onClick={salesRepModal.close}>Cancel</Button>
        <Button onClick={handleSaveSalesRep} loading={saveSalesRepMut.isPending}>{isEditSalesRep ? 'Save Changes' : 'Create'}</Button></>
      }>
        <div className="space-y-4">
          <FormField label="Name" required><input type="text" value={salesRepForm.name} onChange={(e) => setSalesRepForm({ ...salesRepForm, name: e.target.value })} className="form-input" /></FormField>
          <FormField label="Email"><input type="email" value={salesRepForm.email} onChange={(e) => setSalesRepForm({ ...salesRepForm, email: e.target.value })} className="form-input" /></FormField>
          <FormField label="Phone"><input type="text" value={salesRepForm.phone} onChange={(e) => setSalesRepForm({ ...salesRepForm, phone: e.target.value })} className="form-input" /></FormField>
          <FormField label="ERP Salesperson Code"><input type="text" value={salesRepForm.sysproSalesperson} onChange={(e) => setSalesRepForm({ ...salesRepForm, sysproSalesperson: e.target.value })} className="form-input" /></FormField>
          <FormField label="Sales Target"><input type="number" value={salesRepForm.salesTarget} onChange={(e) => setSalesRepForm({ ...salesRepForm, salesTarget: parseFloat(e.target.value) || 0 })} className="form-input" /></FormField>
          <label className="flex items-center gap-2 text-sm text-dark-600 cursor-pointer"><input type="checkbox" checked={salesRepForm.isActive} onChange={(e) => setSalesRepForm({ ...salesRepForm, isActive: e.target.checked })} className="w-4 h-4 rounded border-dark-300" />Active</label>
        </div>
      </Modal>

      {/* Delete Sales Rep Modal */}
      <Modal isOpen={deleteSalesRepModal.isOpen} onClose={deleteSalesRepModal.close} title="Delete Sales Rep" size="sm" footer={
        <><Button variant="secondary" onClick={deleteSalesRepModal.close}>Cancel</Button>
        <Button variant="danger" onClick={() => deleteSalesRepModal.data && removeSalesRepMut.mutate(deleteSalesRepModal.data.Id)} loading={removeSalesRepMut.isPending}>Delete</Button></>
      }>
        <p className="text-sm text-dark-500">Delete <strong className="text-dark-700">{deleteSalesRepModal.data?.Name}</strong>?</p>
      </Modal>
    </div>
  );
}
