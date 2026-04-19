import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  Modal,
  StatusBadge,
  Card,
} from '@/components/shared';
import {
  getRateCards,
  getRateCard,
  createRateCard,
  updateRateCard,
  deleteRateCard as deleteRateCardApi,
  createRateCardVersion,
  getRateCardVersion,
  activateRateCardVersion,
  addRateCardLineItem,
  updateRateCardLineItem,
  deleteRateCardLineItem,
  getBillingRoles,
  getCurrencies,
} from '@/services/admin-service';
import { useModal } from '@shared/hooks';
import type {
  RateCard,
  RateCardVersion,
  RateCardLineItem,
  BillingRole,
  Currency,
} from '@/types';

// ---------------------------------------------------------------------------
// Form types & defaults
// ---------------------------------------------------------------------------

interface RateCardForm {
  name: string;
  description: string;
  status: string;
  notes: string;
}

interface LineItemForm {
  roleId: string;
  currencyId: string;
  rate: number;
  unit: string;
  notes: string;
}

const INITIAL_RATECARD: RateCardForm = { name: '', description: '', status: 'Draft', notes: '' };
const INITIAL_LINEITEM: LineItemForm = { roleId: '', currencyId: '', rate: 0, unit: 'Hour', notes: '' };

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

export function ConnectRateCardsTab() {
  const queryClient = useQueryClient();

  // ---- Selection state ----
  const [selectedRateCard, setSelectedRateCard] = useState<RateCard | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<RateCardVersion | null>(null);

  // ---- Modals ----
  const rateCardModal = useModal<RateCard>();
  const deleteRateCardModal = useModal<RateCard>();
  const lineItemModal = useModal<RateCardLineItem>();

  // ---- Form state ----
  const [rateCardForm, setRateCardForm] = useState<RateCardForm>(INITIAL_RATECARD);
  const [isEditRateCard, setIsEditRateCard] = useState(false);
  const [lineItemForm, setLineItemForm] = useState<LineItemForm>(INITIAL_LINEITEM);
  const [isEditLineItem, setIsEditLineItem] = useState(false);

  // ---- Queries ----

  const { data: rateCardsRes } = useQuery({
    queryKey: ['connect', 'rate-cards'],
    queryFn: getRateCards,
  });

  const { data: rateCardDetail } = useQuery({
    queryKey: ['connect', 'rate-card', selectedRateCard?.Id],
    queryFn: () => getRateCard(selectedRateCard!.Id),
    enabled: !!selectedRateCard,
  });

  const { data: versionDetail } = useQuery({
    queryKey: ['connect', 'rate-card-version', selectedRateCard?.Id, selectedVersion?.Id],
    queryFn: () => getRateCardVersion(selectedRateCard!.Id, selectedVersion!.Id),
    enabled: !!selectedRateCard && !!selectedVersion,
  });

  const { data: billingRolesRes } = useQuery({
    queryKey: ['connect', 'billing-roles'],
    queryFn: getBillingRoles,
    enabled: lineItemModal.isOpen,
  });

  const { data: currenciesRes } = useQuery({
    queryKey: ['admin', 'currencies'],
    queryFn: getCurrencies,
    enabled: lineItemModal.isOpen,
  });

  const rateCards: RateCard[] = rateCardsRes?.data ?? [];
  const billingRoles: BillingRole[] = billingRolesRes?.data ?? [];
  const currencies: Currency[] = currenciesRes?.data ?? [];
  const currentRateCard: RateCard | null = rateCardDetail?.data ?? selectedRateCard;
  const currentVersionRoles: RateCardLineItem[] = versionDetail?.data?.Roles ?? [];
  const currentVersionStatus: string = versionDetail?.data?.Status ?? selectedVersion?.Status ?? '';

  // ---- Mutations ----

  const saveRateCardMut = useMutation({
    mutationFn: (args: { id?: string; data: { name: string; description?: string; status?: string; notes?: string } }) =>
      args.id ? updateRateCard(args.id, args.data as Partial<RateCard>) : createRateCard(args.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'rate-cards'] });
      rateCardModal.close();
      toast.success(isEditRateCard ? 'Rate card updated' : 'Rate card created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save rate card'),
  });

  const removeRateCardMut = useMutation({
    mutationFn: (id: string) => deleteRateCardApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'rate-cards'] });
      deleteRateCardModal.close();
      if (selectedRateCard && selectedRateCard.Id === deleteRateCardModal.data?.Id) {
        setSelectedRateCard(null);
        setSelectedVersion(null);
      }
      toast.success('Rate card deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete rate card'),
  });

  const createVersionMut = useMutation({
    mutationFn: (cardId: string) => createRateCardVersion(cardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'rate-card'] });
      toast.success('New version created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create version'),
  });

  const activateVersionMut = useMutation({
    mutationFn: ({ cardId, versionId }: { cardId: string; versionId: string }) => activateRateCardVersion(cardId, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'rate-card'] });
      queryClient.invalidateQueries({ queryKey: ['connect', 'rate-card-version'] });
      queryClient.invalidateQueries({ queryKey: ['connect', 'rate-cards'] });
      toast.success('Version activated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to activate version'),
  });

  const saveLineItemMut = useMutation({
    mutationFn: (args: { cardId: string; versionId: string; lineId?: string; data: LineItemForm }) => {
      const { cardId, versionId, lineId, data } = args;
      return lineId
        ? updateRateCardLineItem(cardId, versionId, lineId, data)
        : addRateCardLineItem(cardId, versionId, { roleId: data.roleId, currencyId: data.currencyId, rate: data.rate, unit: data.unit, notes: data.notes || undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'rate-card-version'] });
      lineItemModal.close();
      toast.success(isEditLineItem ? 'Line item updated' : 'Line item added');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save line item'),
  });

  const removeLineItemMut = useMutation({
    mutationFn: ({ cardId, versionId, lineId }: { cardId: string; versionId: string; lineId: string }) =>
      deleteRateCardLineItem(cardId, versionId, lineId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'rate-card-version'] });
      toast.success('Line item removed');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to remove line item'),
  });

  // ---- Handlers ----

  function openCreateRateCard() {
    setRateCardForm(INITIAL_RATECARD);
    setIsEditRateCard(false);
    rateCardModal.open();
  }
  function openEditRateCard(rc: RateCard) {
    setRateCardForm({ name: rc.Name, description: rc.Description || '', status: rc.Status, notes: rc.Notes || '' });
    setIsEditRateCard(true);
    rateCardModal.open(rc);
  }
  function handleSaveRateCard() {
    if (!rateCardForm.name.trim()) { toast.error('Name is required'); return; }
    saveRateCardMut.mutate({
      id: isEditRateCard ? rateCardModal.data?.Id : undefined,
      data: rateCardForm,
    });
  }

  function handleSelectRateCard(rc: RateCard) {
    setSelectedRateCard(rc);
    const versions = rc.Versions || [];
    const active = versions.find(v => v.Status === 'Active') || versions[0] || null;
    setSelectedVersion(active);
  }

  function openCreateLineItem() {
    setLineItemForm(INITIAL_LINEITEM);
    setIsEditLineItem(false);
    lineItemModal.open();
  }
  function openEditLineItem(item: RateCardLineItem) {
    setLineItemForm({
      roleId: item.RoleId || '', currencyId: item.CurrencyId || '',
      rate: item.Rate, unit: item.Unit, notes: item.Notes || '',
    });
    setIsEditLineItem(true);
    lineItemModal.open(item);
  }
  function handleSaveLineItem() {
    if (!selectedRateCard || !selectedVersion) return;
    if (!lineItemForm.roleId) { toast.error('Role is required'); return; }
    saveLineItemMut.mutate({
      cardId: selectedRateCard.Id,
      versionId: selectedVersion.Id,
      lineId: isEditLineItem ? lineItemModal.data?.Id : undefined,
      data: lineItemForm,
    });
  }

  // ---- Render ----

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Rate Cards List */}
        <div className="lg:col-span-1">
          <div className="rounded-lg border border-dark-200 bg-dark-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-dark-200 flex items-center justify-between">
              <h2 className="text-sm font-medium text-dark-600">Rate Cards ({rateCards.length})</h2>
              <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreateRateCard}>Add</Button>
            </div>
            <div className="divide-y divide-dark-200 max-h-[500px] overflow-y-auto">
              {rateCards.length === 0 ? (
                <div className="p-6 text-center text-dark-400 text-sm">No rate cards</div>
              ) : rateCards.map((rc) => (
                <button
                  key={rc.Id}
                  type="button"
                  onClick={() => handleSelectRateCard(rc)}
                  className={`w-full px-4 py-3 text-left flex items-center justify-between transition-colors ${
                    selectedRateCard?.Id === rc.Id ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-dark-100'
                  }`}
                >
                  <div>
                    <div className="text-sm font-medium text-dark-600">{rc.Name}</div>
                    <div className="text-xs text-dark-400">
                      <StatusBadge
                        status={rc.Status === 'Active' ? 'success' : rc.Status === 'Archived' ? 'neutral' : 'warning'}
                        label={rc.Status || 'Draft'}
                        size="sm"
                      />
                      <span className="ml-2">{rc.RoleCount ?? 0} roles</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={(e) => { e.stopPropagation(); openEditRateCard(rc); }} className="p-1 text-dark-400 hover:text-primary"><Edit className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); deleteRateCardModal.open(rc); }} className="p-1 text-dark-400 hover:text-danger"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Version Detail */}
        <div className="lg:col-span-2">
          {!selectedRateCard ? (
            <div className="rounded-lg border border-dark-200 bg-dark-50 p-12 text-center">
              <CreditCard className="w-12 h-12 text-dark-300 mx-auto mb-3" />
              <p className="text-dark-400">Select a rate card to view versions and line items.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Version selector */}
              <div className="rounded-lg border border-dark-200 bg-dark-50 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-semibold text-dark-700">{currentRateCard?.Name}</h2>
                  <StatusBadge
                    status={currentRateCard?.Status === 'Active' ? 'success' : currentRateCard?.Status === 'Archived' ? 'neutral' : 'warning'}
                    label={currentRateCard?.Status || 'Draft'}
                    size="sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  {(currentRateCard?.Versions || []).map((v) => (
                    <button
                      key={v.Id}
                      type="button"
                      onClick={() => setSelectedVersion(v)}
                      className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                        selectedVersion?.Id === v.Id
                          ? 'bg-primary text-dark font-medium'
                          : 'bg-dark-100 text-dark-500 hover:bg-dark-200'
                      }`}
                    >
                      v{v.Version}
                      {v.Status === 'Active' && ' *'}
                    </button>
                  ))}
                  <Button size="sm" variant="secondary" onClick={() => createVersionMut.mutate(selectedRateCard!.Id)} loading={createVersionMut.isPending}>
                    + New
                  </Button>
                </div>
              </div>

              {/* Version line items */}
              <Card
                title={selectedVersion ? `v${selectedVersion.Version} — ${currentVersionStatus}` : 'No version selected'}
                headerAction={
                  <div className="flex items-center gap-2">
                    {currentVersionStatus === 'Draft' && (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => {
                          if (selectedRateCard && selectedVersion && window.confirm('Activate this version?')) {
                            activateVersionMut.mutate({ cardId: selectedRateCard.Id, versionId: selectedVersion.Id });
                          }
                        }}>
                          Activate
                        </Button>
                        <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreateLineItem}>
                          Add Line Item
                        </Button>
                      </>
                    )}
                  </div>
                }
              >
                {currentVersionRoles.length === 0 ? (
                  <p className="text-center text-dark-400 text-sm py-6">
                    No line items.{currentVersionStatus === 'Draft' ? ' Click "Add Line Item" to add billing roles.' : ''}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-dark-200">
                          <th className="px-3 py-2 text-left text-xs font-medium text-dark-400">Role</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-dark-400">Code</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-dark-400">Currency</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-dark-400">Rate</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-dark-400">Unit</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-dark-400">Notes</th>
                          {currentVersionStatus === 'Draft' && <th className="px-3 py-2 w-20" />}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-200">
                        {currentVersionRoles.map((item) => (
                          <tr key={item.Id} className="hover:bg-dark-100/50">
                            <td className="px-3 py-2 font-medium text-dark-700">{item.RoleName || '-'}</td>
                            <td className="px-3 py-2"><code className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">{item.RoleCode || '-'}</code></td>
                            <td className="px-3 py-2 text-dark-500">{item.CurrencyCode || '-'}</td>
                            <td className="px-3 py-2 text-right font-semibold text-primary">{Number(item.Rate || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-dark-500">{item.Unit || 'Hour'}</td>
                            <td className="px-3 py-2 text-dark-400 text-xs">{item.Notes || '-'}</td>
                            {currentVersionStatus === 'Draft' && (
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1">
                                  <button type="button" onClick={() => openEditLineItem(item)} className="p-1 text-dark-400 hover:text-primary"><Edit className="w-3.5 h-3.5" /></button>
                                  <button type="button" onClick={() => {
                                    if (selectedRateCard && selectedVersion && window.confirm('Remove this line item?')) {
                                      removeLineItemMut.mutate({ cardId: selectedRateCard.Id, versionId: selectedVersion.Id, lineId: item.Id });
                                    }
                                  }} className="p-1 text-dark-400 hover:text-danger"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Rate Card Modal */}
      <Modal isOpen={rateCardModal.isOpen} onClose={rateCardModal.close} title={isEditRateCard ? 'Edit Rate Card' : 'Add Rate Card'} size="sm" footer={
        <><Button variant="secondary" onClick={rateCardModal.close}>Cancel</Button>
        <Button onClick={handleSaveRateCard} loading={saveRateCardMut.isPending}>{isEditRateCard ? 'Save Changes' : 'Create'}</Button></>
      }>
        <div className="space-y-4">
          <FormField label="Name" required><input type="text" value={rateCardForm.name} onChange={(e) => setRateCardForm({ ...rateCardForm, name: e.target.value })} className="form-input" /></FormField>
          <FormField label="Description"><textarea value={rateCardForm.description} onChange={(e) => setRateCardForm({ ...rateCardForm, description: e.target.value })} className="form-input" rows={2} /></FormField>
          <FormField label="Status">
            <select value={rateCardForm.status} onChange={(e) => setRateCardForm({ ...rateCardForm, status: e.target.value })} className="form-input">
              <option value="Draft">Draft</option>
              <option value="Active">Active</option>
              <option value="Archived">Archived</option>
            </select>
          </FormField>
          <FormField label="Notes"><textarea value={rateCardForm.notes} onChange={(e) => setRateCardForm({ ...rateCardForm, notes: e.target.value })} className="form-input" rows={2} /></FormField>
        </div>
      </Modal>

      {/* Delete Rate Card Modal */}
      <Modal isOpen={deleteRateCardModal.isOpen} onClose={deleteRateCardModal.close} title="Delete Rate Card" size="sm" footer={
        <><Button variant="secondary" onClick={deleteRateCardModal.close}>Cancel</Button>
        <Button variant="danger" onClick={() => deleteRateCardModal.data && removeRateCardMut.mutate(deleteRateCardModal.data.Id)} loading={removeRateCardMut.isPending}>Delete</Button></>
      }>
        <p className="text-sm text-dark-500">Delete <strong className="text-dark-700">{deleteRateCardModal.data?.Name}</strong> and all versions?</p>
      </Modal>

      {/* Line Item Modal */}
      <Modal isOpen={lineItemModal.isOpen} onClose={lineItemModal.close} title={isEditLineItem ? 'Edit Line Item' : 'Add Line Item'} size="sm" footer={
        <><Button variant="secondary" onClick={lineItemModal.close}>Cancel</Button>
        <Button onClick={handleSaveLineItem} loading={saveLineItemMut.isPending}>{isEditLineItem ? 'Save Changes' : 'Add'}</Button></>
      }>
        <div className="space-y-4">
          <FormField label="Billing Role" required>
            <select value={lineItemForm.roleId} onChange={(e) => setLineItemForm({ ...lineItemForm, roleId: e.target.value })} className="form-input">
              <option value="">Select a role...</option>
              {billingRoles.map((r) => <option key={r.Id} value={r.Id}>{r.Name} ({r.Code})</option>)}
            </select>
          </FormField>
          <FormField label="Currency">
            <select value={lineItemForm.currencyId} onChange={(e) => setLineItemForm({ ...lineItemForm, currencyId: e.target.value })} className="form-input">
              <option value="">Select currency...</option>
              {currencies.map((c) => <option key={c.Id} value={c.Id}>{c.Code} - {c.Name}</option>)}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Rate" required><input type="number" value={lineItemForm.rate} onChange={(e) => setLineItemForm({ ...lineItemForm, rate: parseFloat(e.target.value) || 0 })} className="form-input" step="0.01" min={0} /></FormField>
            <FormField label="Unit">
              <select value={lineItemForm.unit} onChange={(e) => setLineItemForm({ ...lineItemForm, unit: e.target.value })} className="form-input">
                <option value="Hour">Hour</option>
                <option value="Day">Day</option>
                <option value="Fixed">Fixed</option>
              </select>
            </FormField>
          </div>
          <FormField label="Notes"><textarea value={lineItemForm.notes} onChange={(e) => setLineItemForm({ ...lineItemForm, notes: e.target.value })} className="form-input" rows={2} /></FormField>
        </div>
      </Modal>
    </div>
  );
}
