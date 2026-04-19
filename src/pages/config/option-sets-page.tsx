import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ListTree, Plus, Edit, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DataTable,
  Button,
  Modal,
  StatusBadge,
  LoadingSpinner,
} from '@/components/shared';
import type { ColumnDef } from '@/components/shared';
import {
  getOptionSets,
  getOptionSet,
  createOptionSet,
  updateOptionSet,
  createOptionSetItem,
  updateOptionSetItem,
  deleteOptionSetItem,
  reorderOptionSetItems,
} from '@/services/admin-service';
import { useModal } from '@shared/hooks';
import type { OptionSet, OptionSetItem } from '@/types';

// ---------------------------------------------------------------------------
// Form types
// ---------------------------------------------------------------------------

interface OptionSetForm {
  name: string;
  displayName: string;
  description: string;
  category: string;
  allowCustomItems: boolean;
  allowMultiSelect: boolean;
  isActive: boolean;
}

interface ItemForm {
  id: string;
  name: string;
  description: string;
  category: string;
  type: string;
  colour: string;
  icon: string;
  badgeVariant: string;
  sortOrder: string;
  isDefault: boolean;
  isActive: boolean;
}

const INITIAL_SET_FORM: OptionSetForm = {
  name: '', displayName: '', description: '', category: '',
  allowCustomItems: true, allowMultiSelect: false, isActive: true,
};

const INITIAL_ITEM_FORM: ItemForm = {
  id: '', name: '', description: '', category: '', type: 'text',
  colour: '', icon: '', badgeVariant: '', sortOrder: '', isDefault: false, isActive: true,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OptionSetsPage() {
  const queryClient = useQueryClient();
  const [selectedSetName, setSelectedSetName] = useState<string | null>(null);
  const setModal = useModal<OptionSet>();
  const itemModal = useModal<OptionSetItem>();
  const deleteItemModal = useModal<OptionSetItem>();
  const [setForm, setSetForm] = useState<OptionSetForm>(INITIAL_SET_FORM);
  const [itemForm, setItemForm] = useState<ItemForm>(INITIAL_ITEM_FORM);
  const [isEditingSet, setIsEditingSet] = useState(false);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [editingItemGuid, setEditingItemGuid] = useState<string | null>(null);

  // ---- Data fetching ----

  const { data: setsResponse, isLoading } = useQuery({
    queryKey: ['admin', 'option-sets'],
    queryFn: getOptionSets,
  });

  const optionSets: OptionSet[] = setsResponse?.data?.optionSets ?? setsResponse?.data ?? [];

  const { data: setDetailResponse, isLoading: detailLoading } = useQuery({
    queryKey: ['admin', 'option-set', selectedSetName],
    queryFn: () => getOptionSet(selectedSetName!),
    enabled: !!selectedSetName,
  });

  const selectedSet = optionSets.find((os) => os.Name === selectedSetName);
  const setDetail = setDetailResponse?.data?.optionSet ?? setDetailResponse?.data;
  const items: OptionSetItem[] = setDetail?.items ?? [];

  // ---- Mutations ----

  const createSetMutation = useMutation({
    mutationFn: (data: Partial<OptionSet>) => createOptionSet(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'option-sets'] });
      setModal.close();
      toast.success('Option set created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create option set'),
  });

  const updateSetMutation = useMutation({
    mutationFn: ({ name, data }: { name: string; data: Partial<OptionSet> }) => updateOptionSet(name, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'option-sets'] });
      setModal.close();
      toast.success('Option set updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update option set'),
  });

  const createItemMutation = useMutation({
    mutationFn: (data: Partial<OptionSetItem>) => createOptionSetItem(selectedSetName!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'option-set', selectedSetName] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'option-sets'] });
      itemModal.close();
      toast.success('Item added');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to add item'),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: Partial<OptionSetItem> }) => updateOptionSetItem(selectedSetName!, itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'option-set', selectedSetName] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'option-sets'] });
      itemModal.close();
      toast.success('Item updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update item'),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => deleteOptionSetItem(selectedSetName!, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'option-set', selectedSetName] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'option-sets'] });
      deleteItemModal.close();
      toast.success('Item deactivated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to deactivate item'),
  });

  const reorderMutation = useMutation({
    mutationFn: (reorderedItems: Array<{ _id: string; sortOrder: number }>) => reorderOptionSetItems(selectedSetName!, reorderedItems),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'option-set', selectedSetName] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to reorder items'),
  });

  // ---- Handlers ----

  function openCreateSet() {
    setSetForm(INITIAL_SET_FORM);
    setIsEditingSet(false);
    setModal.open();
  }

  function openEditSet(os: OptionSet) {
    setSetForm({
      name: os.Name,
      displayName: os.DisplayName || '',
      description: os.Description || '',
      category: os.Category || '',
      allowCustomItems: os.AllowCustomItems !== false,
      allowMultiSelect: os.AllowMultiSelect || false,
      isActive: os.IsActive !== false,
    });
    setIsEditingSet(true);
    setModal.open(os);
  }

  function handleSaveSet() {
    if (!setForm.name.trim()) { toast.error('Name is required'); return; }
    if (isEditingSet && setModal.data) {
      updateSetMutation.mutate({ name: setModal.data.Name, data: setForm });
    } else {
      createSetMutation.mutate(setForm);
    }
  }

  function openCreateItem() {
    if (!selectedSetName) { toast.error('Select an option set first'); return; }
    setItemForm(INITIAL_ITEM_FORM);
    setIsEditingItem(false);
    setEditingItemGuid(null);
    itemModal.open();
  }

  function openEditItem(item: OptionSetItem) {
    setItemForm({
      id: item.id,
      name: item.name || '',
      description: item.description || '',
      category: item.category || '',
      type: item.type || 'text',
      colour: item.colour || '',
      icon: item.icon || '',
      badgeVariant: item.badgeVariant || '',
      sortOrder: item.sortOrder != null ? String(item.sortOrder) : '',
      isDefault: item.isDefault,
      isActive: item.isActive !== false,
    });
    setIsEditingItem(true);
    setEditingItemGuid(item._id);
    itemModal.open(item);
  }

  function handleSaveItem() {
    if (!itemForm.id.trim()) { toast.error('Key is required'); return; }
    if (!itemForm.name.trim()) { toast.error('Name is required'); return; }
    const payload = {
      ...itemForm,
      sortOrder: itemForm.sortOrder ? parseInt(itemForm.sortOrder) : null,
      colour: itemForm.colour || null,
      icon: itemForm.icon || null,
      badgeVariant: itemForm.badgeVariant || null,
      category: itemForm.category || null,
    };
    if (isEditingItem && editingItemGuid) {
      updateItemMutation.mutate({ itemId: editingItemGuid, data: payload as Partial<OptionSetItem> });
    } else {
      createItemMutation.mutate(payload as Partial<OptionSetItem>);
    }
  }

  function moveItem(index: number, direction: 'up' | 'down') {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === items.length - 1) return;
    const newItems = [...items];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newItems[index], newItems[swapIndex]] = [newItems[swapIndex], newItems[index]];
    const reordered = newItems.map((item, i) => ({ _id: item._id, sortOrder: i + 1 }));
    reorderMutation.mutate(reordered);
  }

  function toggleBooleanItem(itemGuid: string, checked: boolean) {
    updateItemMutation.mutate({ itemId: itemGuid, data: { isDefault: checked } as Partial<OptionSetItem> });
  }

  // ---- Column definitions ----

  const setColumns: ColumnDef<OptionSet>[] = [
    {
      key: 'Name',
      label: 'Name',
      sortable: true,
      render: (val) => <code className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">{val}</code>,
    },
    { key: 'DisplayName', label: 'Display Name', sortable: true, render: (val, row) => <span className="text-dark-600">{val || row.Name}</span> },
    { key: 'Category', label: 'Category', width: 120, sortable: true, render: (val) => <span className="text-dark-400">{val || '-'}</span> },
    { key: 'ItemCount', label: 'Items', width: 80, sortable: true, render: (val) => <span className="text-dark-400">{val || 0}</span> },
    {
      key: 'IsSystem',
      label: 'System',
      width: 80,
      sortable: true,
      render: (val) => val ? <StatusBadge status="warning" label="Yes" size="sm" /> : <span className="text-dark-400">-</span>,
    },
    {
      key: 'IsActive',
      label: 'Active',
      width: 80,
      sortable: true,
      render: (val) => <StatusBadge status={val ? 'success' : 'danger'} label={val ? 'Yes' : 'No'} size="sm" />,
    },
    {
      key: 'Name',
      label: 'Actions',
      width: 60,
      sortable: false,
      render: (_val, row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openEditSet(row)} className="p-1.5 text-dark-400 hover:text-primary rounded hover:bg-dark-100 transition-colors" title="Edit">
            <Edit className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const itemColumns: ColumnDef<OptionSetItem>[] = [
    {
      key: 'sortOrder',
      label: '#',
      width: 60,
      sortable: true,
      render: (val, row) => <span className="text-dark-400">{val || items.indexOf(row) + 1}</span>,
    },
    {
      key: 'id',
      label: 'Key',
      width: 140,
      sortable: true,
      render: (val) => <code className="text-xs bg-info/10 text-info px-1.5 py-0.5 rounded">{val}</code>,
    },
    { key: 'name', label: 'Name', sortable: true, render: (val) => <span className="text-dark-700">{val}</span> },
    { key: 'category', label: 'Category', width: 100, sortable: true, render: (val) => <span className="text-dark-400">{val || '-'}</span> },
    { key: 'type', label: 'Type', width: 80, sortable: true, render: (val) => <span className="text-dark-400">{val || 'text'}</span> },
    {
      key: 'colour',
      label: 'Value',
      width: 80,
      sortable: false,
      render: (val, row) => {
        if (row.type === 'boolean') {
          return (
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={row.isDefault}
                onChange={(e) => { e.stopPropagation(); toggleBooleanItem(row._id, e.target.checked); }}
                className="sr-only peer"
                title="Toggle value"
              />
              <div className="w-8 h-4 bg-dark-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-dark-400 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary peer-checked:after:bg-dark" />
            </label>
          );
        }
        if (val) {
          return (
            <div className="flex items-center gap-1">
              <span className="inline-block w-4 h-4 rounded" style={{ backgroundColor: val }} />
              <span className="text-xs text-dark-400">{val}</span>
            </div>
          );
        }
        return <span className="text-dark-400">-</span>;
      },
    },
    {
      key: 'isDefault',
      label: 'Default',
      width: 70,
      sortable: true,
      render: (val) => val ? <StatusBadge status="info" label="Yes" size="sm" /> : <span className="text-dark-400">-</span>,
    },
    {
      key: 'isActive',
      label: 'Active',
      width: 70,
      sortable: true,
      render: (val) => <StatusBadge status={val !== false ? 'success' : 'danger'} label={val !== false ? 'Yes' : 'No'} size="sm" />,
    },
    {
      key: '_id',
      label: 'Actions',
      width: 140,
      sortable: false,
      render: (_val, row) => {
        const idx = items.indexOf(row);
        return (
        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => moveItem(idx, 'up')}
            className="p-1 text-dark-400 hover:text-primary rounded hover:bg-dark-100 transition-colors"
            title="Move up"
            disabled={idx === 0}
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => moveItem(idx, 'down')}
            className="p-1 text-dark-400 hover:text-primary rounded hover:bg-dark-100 transition-colors"
            title="Move down"
            disabled={idx === items.length - 1}
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => openEditItem(row)} className="p-1 text-dark-400 hover:text-primary rounded hover:bg-dark-100 transition-colors" title="Edit">
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => deleteItemModal.open(row)} className="p-1 text-dark-400 hover:text-danger rounded hover:bg-dark-100 transition-colors" title="Deactivate">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        );
      },
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
          <ListTree className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold text-dark-700">Option Sets</h1>
          <span className="text-sm text-dark-400">{optionSets.length} sets</span>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={openCreateSet}>
          New Option Set
        </Button>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: Option sets list */}
        <div className="lg:col-span-2">
          <DataTable<OptionSet>
            id="admin-option-sets"
            columns={setColumns}
            data={optionSets}
            rowKey="Name"
            onRowClick={(row) => setSelectedSetName(row.Name)}
            emptyMessage="No option sets found"
            emptyIcon={ListTree}
          />
        </div>

        {/* Right: Items panel */}
        <div className="lg:col-span-3">
          {!selectedSetName ? (
            <div className="rounded-lg border border-dark-200 bg-dark-50 p-12 text-center">
              <ListTree className="w-12 h-12 text-dark-300 mx-auto mb-3" />
              <p className="text-dark-400">Select an option set to view and manage its items.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Info bar */}
              {selectedSet && (
                <div className="rounded-lg border border-dark-200 bg-dark-50 px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-semibold text-dark-700">{selectedSet.DisplayName || selectedSet.Name}</h2>
                    <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreateItem}>
                      Add Item
                    </Button>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-dark-400">
                    <span>Category: <strong className="text-dark-500">{selectedSet.Category || '-'}</strong></span>
                    <span>Version: <strong className="text-dark-500">{selectedSet.Version || 1}</strong></span>
                    <span>Custom Items: <strong className="text-dark-500">{selectedSet.AllowCustomItems ? 'Yes' : 'No'}</strong></span>
                  </div>
                </div>
              )}

              {/* Items table */}
              {detailLoading ? (
                <div className="flex justify-center py-8"><LoadingSpinner /></div>
              ) : (
                <DataTable<OptionSetItem>
                  id="admin-option-set-items"
                  columns={itemColumns}
                  data={items}
                  rowKey="_id"
                  onRowClick={openEditItem}
                  emptyMessage="No items in this option set"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Option Set Modal */}
      <Modal
        isOpen={setModal.isOpen}
        onClose={setModal.close}
        title={isEditingSet ? 'Edit Option Set' : 'Create Option Set'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={setModal.close}>Cancel</Button>
            <Button onClick={handleSaveSet} loading={createSetMutation.isPending || updateSetMutation.isPending}>
              {isEditingSet ? 'Save Changes' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Name (key)" required>
              <input
                type="text"
                value={setForm.name}
                onChange={(e) => setSetForm({ ...setForm, name: e.target.value })}
                className="form-input"
                placeholder="e.g. task-priorities"
                disabled={isEditingSet}
              />
            </FormField>
            <FormField label="Display Name">
              <input
                type="text"
                value={setForm.displayName}
                onChange={(e) => setSetForm({ ...setForm, displayName: e.target.value })}
                className="form-input"
                placeholder="Task Priorities"
              />
            </FormField>
          </div>
          <FormField label="Description">
            <textarea
              value={setForm.description}
              onChange={(e) => setSetForm({ ...setForm, description: e.target.value })}
              className="form-input"
              rows={2}
              placeholder="Optional description"
            />
          </FormField>
          <FormField label="Category">
            <input
              type="text"
              value={setForm.category}
              onChange={(e) => setSetForm({ ...setForm, category: e.target.value })}
              className="form-input"
              placeholder="e.g. crm, projects"
            />
          </FormField>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-dark-600 cursor-pointer">
              <input
                type="checkbox"
                checked={setForm.allowCustomItems}
                onChange={(e) => setSetForm({ ...setForm, allowCustomItems: e.target.checked })}
                className="w-4 h-4 rounded border-dark-300"
              />
              Allow custom items
            </label>
            <label className="flex items-center gap-2 text-sm text-dark-600 cursor-pointer">
              <input
                type="checkbox"
                checked={setForm.allowMultiSelect}
                onChange={(e) => setSetForm({ ...setForm, allowMultiSelect: e.target.checked })}
                className="w-4 h-4 rounded border-dark-300"
              />
              Allow multi-select
            </label>
            <label className="flex items-center gap-2 text-sm text-dark-600 cursor-pointer">
              <input
                type="checkbox"
                checked={setForm.isActive}
                onChange={(e) => setSetForm({ ...setForm, isActive: e.target.checked })}
                className="w-4 h-4 rounded border-dark-300"
              />
              Active
            </label>
          </div>
        </div>
      </Modal>

      {/* Create/Edit Item Modal */}
      <Modal
        isOpen={itemModal.isOpen}
        onClose={itemModal.close}
        title={isEditingItem ? 'Edit Item' : `Add Item to "${selectedSet?.DisplayName || selectedSet?.Name || ''}"` }
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={itemModal.close}>Cancel</Button>
            <Button onClick={handleSaveItem} loading={createItemMutation.isPending || updateItemMutation.isPending}>
              {isEditingItem ? 'Save Changes' : 'Add Item'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Key" required>
              <input
                type="text"
                value={itemForm.id}
                onChange={(e) => setItemForm({ ...itemForm, id: e.target.value })}
                className="form-input"
                placeholder="e.g. high"
                disabled={isEditingItem}
              />
            </FormField>
            <FormField label="Name" required>
              <input
                type="text"
                value={itemForm.name}
                onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                className="form-input"
                placeholder="e.g. High Priority"
              />
            </FormField>
          </div>
          <FormField label="Description">
            <input
              type="text"
              value={itemForm.description}
              onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
              className="form-input"
              placeholder="Optional description"
            />
          </FormField>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Category">
              <input
                type="text"
                value={itemForm.category}
                onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                className="form-input"
                placeholder="Optional"
              />
            </FormField>
            <FormField label="Type">
              <select
                value={itemForm.type}
                onChange={(e) => setItemForm({ ...itemForm, type: e.target.value })}
                className="form-input"
                title="Item type"
              >
                <option value="text">Text</option>
                <option value="boolean">Boolean</option>
                <option value="color">Color</option>
                <option value="number">Number</option>
              </select>
            </FormField>
            <FormField label="Sort Order">
              <input
                type="number"
                value={itemForm.sortOrder}
                onChange={(e) => setItemForm({ ...itemForm, sortOrder: e.target.value })}
                className="form-input"
                placeholder="Auto"
                min={0}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Color">
              <div className="flex items-center gap-2">
                {itemForm.colour && (
                  <span className="w-6 h-6 rounded border border-dark-300" style={{ backgroundColor: itemForm.colour }} />
                )}
                <input
                  type="text"
                  value={itemForm.colour}
                  onChange={(e) => setItemForm({ ...itemForm, colour: e.target.value })}
                  className="form-input flex-1"
                  placeholder="#hex"
                />
              </div>
            </FormField>
            <FormField label="Icon">
              <input
                type="text"
                value={itemForm.icon}
                onChange={(e) => setItemForm({ ...itemForm, icon: e.target.value })}
                className="form-input"
                placeholder="Icon name"
              />
            </FormField>
            <FormField label="Badge Variant">
              <input
                type="text"
                value={itemForm.badgeVariant}
                onChange={(e) => setItemForm({ ...itemForm, badgeVariant: e.target.value })}
                className="form-input"
                placeholder="e.g. success"
              />
            </FormField>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-dark-600 cursor-pointer">
              <input
                type="checkbox"
                checked={itemForm.isDefault}
                onChange={(e) => setItemForm({ ...itemForm, isDefault: e.target.checked })}
                className="w-4 h-4 rounded border-dark-300"
              />
              Default
            </label>
            <label className="flex items-center gap-2 text-sm text-dark-600 cursor-pointer">
              <input
                type="checkbox"
                checked={itemForm.isActive}
                onChange={(e) => setItemForm({ ...itemForm, isActive: e.target.checked })}
                className="w-4 h-4 rounded border-dark-300"
              />
              Active
            </label>
          </div>
        </div>
      </Modal>

      {/* Delete Item Modal */}
      <Modal
        isOpen={deleteItemModal.isOpen}
        onClose={deleteItemModal.close}
        title="Deactivate Item"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={deleteItemModal.close}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => deleteItemModal.data && deleteItemMutation.mutate(deleteItemModal.data._id)}
              loading={deleteItemMutation.isPending}
            >
              Deactivate
            </Button>
          </>
        }
      >
        <p className="text-sm text-dark-500">
          Are you sure you want to deactivate <strong className="text-dark-700">{deleteItemModal.data?.name}</strong>?
          This will mark the item as inactive.
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
