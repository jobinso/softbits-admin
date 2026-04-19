import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ListTree, Search, Plus, Sliders } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  Modal,
  LoadingSpinner,
} from '@/components/shared';
import {
  getOptionSets,
  createOptionSet,
} from '@/services/admin-service';
import { useModal } from '@shared/hooks';
import type { OptionSet } from '@/types';
import OptionSetDetail from './option-set-detail';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OptionsPage() {
  const queryClient = useQueryClient();
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const createSetModal = useModal();
  const [newSetForm, setNewSetForm] = useState({ name: '', displayName: '', description: '', category: '' });

  // ---- Data fetching ----

  const { data: setsResponse, isLoading: setsLoading } = useQuery({
    queryKey: ['admin', 'option-sets'],
    queryFn: getOptionSets,
  });

  const allOptionSets: OptionSet[] = setsResponse?.data?.optionSets ?? setsResponse?.data ?? [];

  // ---- Filter by search ----

  const filteredOptionSets = useMemo(() => {
    if (!searchQuery) return allOptionSets;
    const q = searchQuery.toLowerCase();
    return allOptionSets.filter(
      (os) =>
        os.Name.toLowerCase().includes(q) ||
        (os.DisplayName || '').toLowerCase().includes(q) ||
        (os.Category || '').toLowerCase().includes(q)
    );
  }, [allOptionSets, searchQuery]);

  const selectedOptionSet = selectedName
    ? allOptionSets.find((os) => os.Name === selectedName)
    : null;

  // ---- Create mutation ----

  const createSetMutation = useMutation({
    mutationFn: (data: Partial<OptionSet>) => createOptionSet(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'option-sets'] });
      createSetModal.close();
      toast.success('Option set created');
      setNewSetForm({ name: '', displayName: '', description: '', category: '' });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create option set'),
  });

  function handleCreateSet() {
    if (!newSetForm.name.trim()) { toast.error('Name is required'); return; }
    createSetMutation.mutate(newSetForm);
  }

  // ---- Loading ----

  if (setsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // ---- Render ----

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Left sidebar */}
      <div className="lg:col-span-1">
        <div className="rounded-lg border border-border bg-surface-raised">
          {/* Search */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-semantic-text-faint" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search option sets..."
                className="form-input pl-8 text-xs py-1.5"
              />
            </div>
          </div>

          <div className="p-2 max-h-[calc(100vh-280px)] overflow-y-auto">
            <div className="px-2 py-1.5 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-bold text-semantic-text-faint">
                Option Sets
              </span>
              <button
                type="button"
                onClick={() => { setNewSetForm({ name: '', displayName: '', description: '', category: '' }); createSetModal.open(); }}
                className="p-0.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover transition-colors"
                title="New option set"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            {filteredOptionSets.map((os) => {
              const isSelected = selectedName === os.Name;
              return (
                <button
                  key={os.Name}
                  type="button"
                  onClick={() => setSelectedName(os.Name)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md mb-0.5 transition-colors ${
                    isSelected
                      ? 'bg-accent-primary/10 text-accent-primary font-medium'
                      : 'text-semantic-text-subtle hover:bg-interactive-hover'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ListTree className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{os.DisplayName || os.Name}</span>
                  </div>
                  <span className="text-[10px] text-semantic-text-faint ml-1">{os.ItemCount || 0}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right detail panel */}
      <div className="lg:col-span-3">
        {!selectedOptionSet ? (
          <div className="rounded-lg border border-border bg-surface-raised p-12 text-center">
            <Sliders className="w-12 h-12 text-semantic-text-disabled mx-auto mb-3" />
            <p className="text-semantic-text-faint">Select an option set to view and manage its items.</p>
          </div>
        ) : (
          <OptionSetDetail
            setName={selectedName!}
            optionSet={selectedOptionSet}
          />
        )}
      </div>

      {/* Create Option Set Modal */}
      <Modal
        isOpen={createSetModal.isOpen}
        onClose={createSetModal.close}
        title="Create Option Set"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={createSetModal.close}>Cancel</Button>
            <Button onClick={handleCreateSet} loading={createSetMutation.isPending}>Create</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Name (key)" required>
              <input
                type="text"
                value={newSetForm.name}
                onChange={(e) => setNewSetForm({ ...newSetForm, name: e.target.value })}
                className="form-input"
                placeholder="e.g. task-priorities"
              />
            </FormField>
            <FormField label="Display Name">
              <input
                type="text"
                value={newSetForm.displayName}
                onChange={(e) => setNewSetForm({ ...newSetForm, displayName: e.target.value })}
                className="form-input"
                placeholder="Task Priorities"
              />
            </FormField>
          </div>
          <FormField label="Description">
            <textarea
              value={newSetForm.description}
              onChange={(e) => setNewSetForm({ ...newSetForm, description: e.target.value })}
              className="form-input"
              rows={2}
              placeholder="Optional description"
            />
          </FormField>
          <FormField label="Category">
            <input
              type="text"
              value={newSetForm.category}
              onChange={(e) => setNewSetForm({ ...newSetForm, category: e.target.value })}
              className="form-input"
              placeholder="e.g. CRM, System"
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local helper component
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
