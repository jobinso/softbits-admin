import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, ArrowUp, ArrowDown, Lock, Filter } from 'lucide-react';
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
  getOptionSet,
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

interface OptionSetForm {
  name: string;
  displayName: string;
  description: string;
  category: string;
  allowCustomItems: boolean;
  allowMultiSelect: boolean;
  isActive: boolean;
}

const INITIAL_ITEM_FORM: ItemForm = {
  id: '', name: '', description: '', category: '', type: 'text',
  colour: '', icon: '', badgeVariant: '', sortOrder: '', isDefault: false, isActive: true,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OptionSetDetailProps {
  setName: string;
  optionSet: OptionSet;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OptionSetDetail({ setName, optionSet }: OptionSetDetailProps) {
  const queryClient = useQueryClient();
  const setModal = useModal<OptionSet>();
  const itemModal = useModal<OptionSetItem>();
  const deleteItemModal = useModal<OptionSetItem>();
  const [setForm, setSetForm] = useState<OptionSetForm>({
    name: '', displayName: '', description: '', category: '',
    allowCustomItems: true, allowMultiSelect: false, isActive: true,
  });
  const [itemForm, setItemForm] = useState<ItemForm>(INITIAL_ITEM_FORM);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [editingItemGuid, setEditingItemGuid] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  // ---- Data fetching ----

  const { data: setDetailResponse, isLoading: detailLoading } = useQuery({
    queryKey: ['admin', 'option-set', setName],
    queryFn: () => getOptionSet(setName),
    enabled: !!setName,
  });

  const setDetail = setDetailResponse?.data?.optionSet ?? setDetailResponse?.data;
  const items: OptionSetItem[] = setDetail?.items ?? [];

  const categories = useMemo(() => {
    const cats = new Set<string>();
    items.forEach((item) => { if (item.category) cats.add(item.category); });
    return Array.from(cats).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    if (!categoryFilter) return items;
    return items.filter((item) => item.category === categoryFilter);
  }, [items, categoryFilter]);

  // ---- Mutations ----

  const updateSetMutation = useMutation({
    mutationFn: ({ name, data }: { name: string; data: Partial<OptionSet> }) => updateOptionSet(name, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'option-sets'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'option-set', setName] });
      setModal.close();
      toast.success('Option set updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update option set'),
  });

  const createItemMutation = useMutation({
    mutationFn: (data: Partial<OptionSetItem>) => createOptionSetItem(setName, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'option-set', setName] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'option-sets'] });
      itemModal.close();
      toast.success('Item added');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to add item'),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: Partial<OptionSetItem> }) => updateOptionSetItem(setName, itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'option-set', setName] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'option-sets'] });
      itemModal.close();
      toast.success('Item updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update item'),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => deleteOptionSetItem(setName, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'option-set', setName] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'option-sets'] });
      deleteItemModal.close();
      toast.success('Item deactivated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to deactivate item'),
  });

  const reorderMutation = useMutation({
    mutationFn: (reorderedItems: Array<{ _id: string; sortOrder: number }>) => reorderOptionSetItems(setName, reorderedItems),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'option-set', setName] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to reorder items'),
  });

  // ---- Handlers ----

  function openEditSet() {
    setSetForm({
      name: optionSet.Name,
      displayName: optionSet.DisplayName || '',
      description: optionSet.Description || '',
      category: optionSet.Category || '',
      allowCustomItems: optionSet.AllowCustomItems !== false,
      allowMultiSelect: optionSet.AllowMultiSelect || false,
      isActive: optionSet.IsActive !== false,
    });
    setModal.open(optionSet);
  }

  function handleSaveSet() {
    updateSetMutation.mutate({ name: optionSet.Name, data: setForm });
  }

  function openCreateItem() {
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

  const itemColumns: ColumnDef<OptionSetItem>[] = [
    {
      key: 'sortOrder',
      label: '#',
      width: 60,
      sortable: true,
      render: (val, row) => <span className="text-semantic-text-faint">{val || items.indexOf(row) + 1}</span>,
    },
    {
      key: 'id',
      label: 'Key',
      width: 140,
      sortable: true,
      render: (val) => <code className="text-xs bg-info/10 text-info px-1.5 py-0.5 rounded">{val}</code>,
    },
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (val, row) => (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-semantic-text-default">{val}</span>
          {row.isSystem && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-semantic-text-faint bg-surface-subtle border border-border px-1.5 py-0.5 rounded-full">
              <Lock className="w-2.5 h-2.5" />
              System
            </span>
          )}
        </span>
      ),
    },
    { key: 'category', label: 'Category', width: 100, sortable: true, render: (val) => <span className="text-semantic-text-faint">{val || '-'}</span> },
    { key: 'type', label: 'Type', width: 80, sortable: true, render: (val) => <span className="text-semantic-text-faint">{val || 'text'}</span> },
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
              <div className="w-8 h-4 bg-surface-subtle rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-semantic-text-faint after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-accent-primary peer-checked:after:bg-semantic-text-on-primary" />
            </label>
          );
        }
        if (val) {
          return (
            <div className="flex items-center gap-1">
              <span className="inline-block w-4 h-4 rounded" style={{ backgroundColor: val }} />
              <span className="text-xs text-semantic-text-faint">{val}</span>
            </div>
          );
        }
        return <span className="text-semantic-text-faint">-</span>;
      },
    },
    {
      key: 'isDefault',
      label: 'Default',
      width: 70,
      sortable: true,
      render: (val) => val ? <StatusBadge status="info" label="Yes" size="sm" /> : <span className="text-semantic-text-faint">-</span>,
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
              className="p-1 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover transition-colors"
              title="Move up"
              disabled={idx === 0}
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => moveItem(idx, 'down')}
              className="p-1 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover transition-colors"
              title="Move down"
              disabled={idx === items.length - 1}
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => openEditItem(row)} className="p-1 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover transition-colors" title="Edit">
              <Edit className="w-3.5 h-3.5" />
            </button>
            {!row.isSystem && (
              <button type="button" onClick={() => deleteItemModal.open(row)} className="p-1 text-semantic-text-faint hover:text-danger rounded hover:bg-interactive-hover transition-colors" title="Deactivate">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  // ---- Render ----

  return (
    <div className="space-y-3">
      {/* Info bar */}
      <div className="rounded-lg border border-border bg-surface-raised px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-semantic-text-default">{optionSet.DisplayName || optionSet.Name}</h2>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" icon={<Edit className="w-3.5 h-3.5" />} onClick={openEditSet}>
              Edit Set
            </Button>
            <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreateItem}>
              Add Item
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-semantic-text-faint">
          <span>Category: <strong className="text-semantic-text-subtle">{optionSet.Category || '-'}</strong></span>
          <span>Version: <strong className="text-semantic-text-subtle">{optionSet.Version || 1}</strong></span>
          <span>Custom Items: <strong className="text-semantic-text-subtle">{optionSet.AllowCustomItems ? 'Yes' : 'No'}</strong></span>
        </div>
      </div>

      {/* Items table */}
      {detailLoading ? (
        <div className="flex justify-center py-8"><LoadingSpinner /></div>
      ) : (
        <TableCard title="Items" count={filteredItems.length}>
          {categories.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
              <Filter className="w-3.5 h-3.5 text-semantic-text-faint" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="form-input text-xs py-1 px-2 w-auto min-w-[140px]"
                title="Filter by category"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              {categoryFilter && (
                <button
                  type="button"
                  onClick={() => setCategoryFilter('')}
                  className="text-xs text-semantic-text-faint hover:text-semantic-text-default transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          )}
          <DataTable<OptionSetItem>
            id="admin-option-set-items"
            columns={itemColumns}
            data={filteredItems}
            rowKey="_id"
            onRowClick={openEditItem}
            emptyMessage="No items in this option set"
            embedded
            showColumnPicker={false}
          />
        </TableCard>
      )}

      {/* Edit Option Set Modal */}
      <Modal
        isOpen={setModal.isOpen}
        onClose={setModal.close}
        title="Edit Option Set"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={setModal.close}>Cancel</Button>
            <Button onClick={handleSaveSet} loading={updateSetMutation.isPending}>
              Save Changes
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
                className="form-input bg-surface-subtle text-semantic-text-faint"
                disabled
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
            <label className="flex items-center gap-2 text-sm text-semantic-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={setForm.allowCustomItems}
                onChange={(e) => setSetForm({ ...setForm, allowCustomItems: e.target.checked })}
                className="w-4 h-4 rounded border-border"
              />
              Allow custom items
            </label>
            <label className="flex items-center gap-2 text-sm text-semantic-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={setForm.allowMultiSelect}
                onChange={(e) => setSetForm({ ...setForm, allowMultiSelect: e.target.checked })}
                className="w-4 h-4 rounded border-border"
              />
              Allow multi-select
            </label>
            <label className="flex items-center gap-2 text-sm text-semantic-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={setForm.isActive}
                onChange={(e) => setSetForm({ ...setForm, isActive: e.target.checked })}
                className="w-4 h-4 rounded border-border"
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
        title={isEditingItem ? 'Edit Item' : `Add Item to "${optionSet.DisplayName || optionSet.Name}"`}
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
                  <span className="w-6 h-6 rounded border border-border" style={{ backgroundColor: itemForm.colour }} />
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
            <label className="flex items-center gap-2 text-sm text-semantic-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={itemForm.isDefault}
                onChange={(e) => setItemForm({ ...itemForm, isDefault: e.target.checked })}
                className="w-4 h-4 rounded border-border"
              />
              Default
            </label>
            <label className="flex items-center gap-2 text-sm text-semantic-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={itemForm.isActive}
                onChange={(e) => setItemForm({ ...itemForm, isActive: e.target.checked })}
                className="w-4 h-4 rounded border-border"
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
        <p className="text-sm text-semantic-text-subtle">
          Are you sure you want to deactivate <strong className="text-semantic-text-default">{deleteItemModal.data?.name}</strong>?
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
      <label className="block text-xs font-medium text-semantic-text-subtle mb-1">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
