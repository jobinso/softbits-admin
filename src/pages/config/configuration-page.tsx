import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Search, Plus, Sliders, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  Modal,
  LoadingSpinner,
} from '@/components/shared';
import {
  getSystemSettings,
  createSystemSetting,
  reloadSettingsCache,
} from '@/services/admin-service';
import { useModal } from '@shared/hooks';
import type { SystemSetting } from '@/types';
import SettingsCategoryDetail, {
  getCategory,
  getCategoryLabel,
  KNOWN_CATEGORY_ORDER,
} from './settings-category-detail';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ConfigurationPage() {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const createSettingModal = useModal();
  const [newSettingForm, setNewSettingForm] = useState({ key: '', value: '', description: '', dataType: 'string' as const });

  // ---- Data fetching ----

  const { data: settingsResponse, isLoading: settingsLoading } = useQuery({
    queryKey: ['admin', 'system-settings'],
    queryFn: getSystemSettings,
  });

  const allSettings: SystemSetting[] = settingsResponse?.data ?? [];

  // ---- Group settings by category ----

  const settingsCategories = useMemo(() => {
    const groups: Record<string, SystemSetting[]> = {};
    for (const setting of allSettings) {
      const cat = getCategory(setting.SettingKey);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(setting);
    }
    return Object.entries(groups).sort(([a], [b]) => {
      const aIdx = KNOWN_CATEGORY_ORDER.indexOf(a);
      const bIdx = KNOWN_CATEGORY_ORDER.indexOf(b);
      if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
      if (aIdx >= 0) return -1;
      if (bIdx >= 0) return 1;
      return a.localeCompare(b);
    });
  }, [allSettings]);

  // ---- Filter by search ----

  const filteredCategories = useMemo(() => {
    if (!searchQuery) return settingsCategories;
    const q = searchQuery.toLowerCase();
    return settingsCategories
      .map(([cat, settings]) => {
        if (getCategoryLabel(cat).toLowerCase().includes(q)) return [cat, settings] as [string, SystemSetting[]];
        const filtered = settings.filter(
          (s) =>
            s.SettingKey.toLowerCase().includes(q) ||
            (s.SettingValue || '').toLowerCase().includes(q) ||
            (s.Description || '').toLowerCase().includes(q)
        );
        return filtered.length > 0 ? [cat, filtered] as [string, SystemSetting[]] : null;
      })
      .filter(Boolean) as [string, SystemSetting[]][];
  }, [settingsCategories, searchQuery]);

  // ---- Get selected data ----

  const selectedSettingsCategory = selectedCategory
    ? settingsCategories.find(([cat]) => cat === selectedCategory)
    : null;

  // ---- Mutations ----

  const createSettingMutation = useMutation({
    mutationFn: (data: { key: string; value: string; description?: string; dataType?: string }) =>
      createSystemSetting(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'system-settings'] });
      createSettingModal.close();
      toast.success('Setting created');
      setNewSettingForm({ key: '', value: '', description: '', dataType: 'string' });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create setting'),
  });

  function handleCreateSetting() {
    if (!newSettingForm.key.trim()) { toast.error('Key is required'); return; }
    if (newSettingForm.dataType === 'json') {
      try { JSON.parse(newSettingForm.value); } catch { toast.error('Invalid JSON value'); return; }
    }
    createSettingMutation.mutate(newSettingForm);
  }

  const reloadMutation = useMutation({
    mutationFn: reloadSettingsCache,
    onSuccess: (res) => toast.success(`Settings cache reloaded (${res?.data?.count ?? '?'} settings)`),
    onError: (err: Error) => toast.error(err.message || 'Failed to reload settings cache'),
  });

  // ---- Loading ----

  if (settingsLoading) {
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
                placeholder="Search settings..."
                className="form-input pl-8 text-xs py-1.5"
              />
            </div>
          </div>

          <div className="p-2 max-h-[calc(100vh-280px)] overflow-y-auto">
            <div className="px-2 py-1.5 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-bold text-semantic-text-faint">
                Settings
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => reloadMutation.mutate()}
                  disabled={reloadMutation.isPending}
                  className="p-0.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover transition-colors disabled:opacity-50"
                  title="Reload settings cache on server"
                >
                  <RefreshCw className={`w-3 h-3 ${reloadMutation.isPending ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => { setNewSettingForm({ key: '', value: '', description: '', dataType: 'string' }); createSettingModal.open(); }}
                  className="p-0.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover transition-colors"
                  title="Add setting"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
            {filteredCategories.map(([category, settings]) => {
              const isSelected = selectedCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md mb-0.5 transition-colors ${
                    isSelected
                      ? 'bg-accent-primary/10 text-accent-primary font-medium'
                      : 'text-semantic-text-subtle hover:bg-interactive-hover'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Settings className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{getCategoryLabel(category)}</span>
                  </div>
                  <span className="text-[10px] text-semantic-text-faint ml-1">{settings.length}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right detail panel */}
      <div className="lg:col-span-3">
        {!selectedSettingsCategory ? (
          <div className="rounded-lg border border-border bg-surface-raised p-12 text-center">
            <Sliders className="w-12 h-12 text-semantic-text-disabled mx-auto mb-3" />
            <p className="text-semantic-text-faint">Select a settings category to view and manage its configuration.</p>
          </div>
        ) : (
          <SettingsCategoryDetail
            category={selectedSettingsCategory[0]}
            settings={selectedSettingsCategory[1]}
          />
        )}
      </div>

      {/* Create Setting Modal */}
      <Modal
        isOpen={createSettingModal.isOpen}
        onClose={createSettingModal.close}
        title="Add Setting"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={createSettingModal.close}>Cancel</Button>
            <Button onClick={handleCreateSetting} loading={createSettingMutation.isPending}>Create</Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Key" required>
            <input
              type="text"
              value={newSettingForm.key}
              onChange={(e) => setNewSettingForm({ ...newSettingForm, key: e.target.value })}
              className="form-input"
              placeholder="category.setting.name"
            />
            <p className="text-xs text-semantic-text-faint mt-1">
              Use dot notation for categories (e.g., pos.receipt.footerText)
            </p>
          </FormField>
          <FormField label="Data Type">
            <select
              value={newSettingForm.dataType}
              onChange={(e) => setNewSettingForm({ ...newSettingForm, dataType: e.target.value as 'string' | 'number' | 'boolean' | 'json' })}
              className="form-input"
              title="Data type"
            >
              <option value="string">String</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
              <option value="json">JSON</option>
            </select>
          </FormField>
          <FormField label="Value" required>
            <input
              type="text"
              value={newSettingForm.value}
              onChange={(e) => setNewSettingForm({ ...newSettingForm, value: e.target.value })}
              className="form-input"
            />
          </FormField>
          <FormField label="Description">
            <input
              type="text"
              value={newSettingForm.description}
              onChange={(e) => setNewSettingForm({ ...newSettingForm, description: e.target.value })}
              className="form-input"
              placeholder="Brief description of this setting"
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
