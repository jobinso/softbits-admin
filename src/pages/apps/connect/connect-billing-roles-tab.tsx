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
  getBillingRoles,
  createBillingRole,
  updateBillingRole,
  deleteBillingRole as deleteBillingRoleApi,
} from '@/services/admin-service';
import { useModal } from '@shared/hooks';
import type { BillingRole } from '@/types';

// ---------------------------------------------------------------------------
// Form types & defaults
// ---------------------------------------------------------------------------

interface BillingRoleForm {
  code: string;
  name: string;
  description: string;
  status: string;
}

const INITIAL_BILLINGROLE: BillingRoleForm = { code: '', name: '', description: '', status: 'Active' };

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

export function ConnectBillingRolesTab() {
  const queryClient = useQueryClient();

  // ---- Modals ----
  const billingRoleModal = useModal<BillingRole>();
  const deleteBillingRoleModal = useModal<BillingRole>();

  // ---- Form state ----
  const [billingRoleForm, setBillingRoleForm] = useState<BillingRoleForm>(INITIAL_BILLINGROLE);
  const [isEditBillingRole, setIsEditBillingRole] = useState(false);

  // ---- Queries ----

  const { data: billingRolesRes } = useQuery({
    queryKey: ['connect', 'billing-roles'],
    queryFn: getBillingRoles,
  });

  const billingRoles: BillingRole[] = billingRolesRes?.data ?? [];

  // ---- Mutations ----

  const saveBillingRoleMut = useMutation({
    mutationFn: (args: { id?: string; data: Partial<BillingRole> }) =>
      args.id ? updateBillingRole(args.id, args.data) : createBillingRole(args.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'billing-roles'] });
      billingRoleModal.close();
      toast.success(isEditBillingRole ? 'Billing role updated' : 'Billing role created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save billing role'),
  });

  const removeBillingRoleMut = useMutation({
    mutationFn: (id: string) => deleteBillingRoleApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'billing-roles'] });
      deleteBillingRoleModal.close();
      toast.success('Billing role deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete billing role'),
  });

  // ---- Handlers ----

  function openCreateBillingRole() {
    setBillingRoleForm(INITIAL_BILLINGROLE);
    setIsEditBillingRole(false);
    billingRoleModal.open();
  }
  function openEditBillingRole(r: BillingRole) {
    setBillingRoleForm({ code: r.Code, name: r.Name, description: r.Description || '', status: r.Status });
    setIsEditBillingRole(true);
    billingRoleModal.open(r);
  }
  function handleSaveBillingRole() {
    if (!billingRoleForm.name.trim()) { toast.error('Name is required'); return; }
    if (!billingRoleForm.code.trim()) { toast.error('Code is required'); return; }
    saveBillingRoleMut.mutate({
      id: isEditBillingRole ? billingRoleModal.data?.Id : undefined,
      data: billingRoleForm,
    });
  }

  // ---- Column definitions ----

  const billingRoleColumns: ColumnDef<BillingRole>[] = [
    { key: 'Code', label: 'Code', width: 120, sortable: true, render: (v) => <code className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">{v}</code> },
    { key: 'Name', label: 'Name', sortable: true, render: (v) => <span className="font-medium text-dark-700">{v}</span> },
    { key: 'Description', label: 'Description', sortable: false, render: (v) => v || '-' },
    { key: 'Status', label: 'Status', width: 90, sortable: true, render: (v) => <StatusBadge status={v === 'Active' ? 'success' : 'neutral'} label={v || 'Active'} size="sm" /> },
    {
      key: 'Id', label: 'Actions', width: 100, sortable: false,
      render: (_v, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openEditBillingRole(row)} className="p-1.5 text-dark-400 hover:text-primary rounded hover:bg-dark-100" title="Edit"><Edit className="w-4 h-4" /></button>
          <button type="button" onClick={() => deleteBillingRoleModal.open(row)} className="p-1.5 text-dark-400 hover:text-danger rounded hover:bg-dark-100" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  // ---- Render ----

  return (
    <>
      <Card title={`Billing Roles (${billingRoles.length})`} headerAction={
        <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreateBillingRole}>Add Role</Button>
      }>
        <DataTable<BillingRole>
          id="connect-billing-roles"
          columns={billingRoleColumns}
          data={billingRoles}
          rowKey={(row) => row.Id}
          onRowClick={openEditBillingRole}
          emptyMessage="No billing roles. Click Add Role to create one."
        />
      </Card>

      {/* Billing Role Modal */}
      <Modal isOpen={billingRoleModal.isOpen} onClose={billingRoleModal.close} title={isEditBillingRole ? 'Edit Billing Role' : 'Add Billing Role'} size="sm" footer={
        <><Button variant="secondary" onClick={billingRoleModal.close}>Cancel</Button>
        <Button onClick={handleSaveBillingRole} loading={saveBillingRoleMut.isPending}>{isEditBillingRole ? 'Save Changes' : 'Create'}</Button></>
      }>
        <div className="space-y-4">
          <FormField label="Code" required><input type="text" value={billingRoleForm.code} onChange={(e) => setBillingRoleForm({ ...billingRoleForm, code: e.target.value })} className="form-input" placeholder="e.g. DEV-SR" disabled={isEditBillingRole} /></FormField>
          <FormField label="Name" required><input type="text" value={billingRoleForm.name} onChange={(e) => setBillingRoleForm({ ...billingRoleForm, name: e.target.value })} className="form-input" placeholder="e.g. Senior Developer" /></FormField>
          <FormField label="Description"><textarea value={billingRoleForm.description} onChange={(e) => setBillingRoleForm({ ...billingRoleForm, description: e.target.value })} className="form-input" rows={2} /></FormField>
          <FormField label="Status">
            <select value={billingRoleForm.status} onChange={(e) => setBillingRoleForm({ ...billingRoleForm, status: e.target.value })} className="form-input">
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </FormField>
        </div>
      </Modal>

      {/* Delete Billing Role Modal */}
      <Modal isOpen={deleteBillingRoleModal.isOpen} onClose={deleteBillingRoleModal.close} title="Delete Billing Role" size="sm" footer={
        <><Button variant="secondary" onClick={deleteBillingRoleModal.close}>Cancel</Button>
        <Button variant="danger" onClick={() => deleteBillingRoleModal.data && removeBillingRoleMut.mutate(deleteBillingRoleModal.data.Id)} loading={removeBillingRoleMut.isPending}>Delete</Button></>
      }>
        <p className="text-sm text-dark-500">Delete billing role <strong className="text-dark-700">{deleteBillingRoleModal.data?.Name}</strong>?</p>
      </Modal>
    </>
  );
}
