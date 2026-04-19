import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronRight, Plus, X, Save } from 'lucide-react';
import { Button } from '@/components/shared';
import { updateConnectEntityConfig, getConnectFields } from '@/services/admin-service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WritebackFieldConfig {
  connectField: string;
  type?: string;
  description?: string;
}

export interface WritebackConfig {
  enabled: boolean;
  formType: string;
  keyFieldName?: string;
  fields: Record<string, WritebackFieldConfig>;
}

interface WritebackPanelProps {
  /** Sync entity type key (e.g., 'customers', 'suppliers', 'accounts') */
  entityType: string;
  /** Current FieldMapping JSON from adm_CrmSyncConfig (parsed) */
  fieldMapping: Record<string, unknown> | null;
}

const DEFAULT_WRITEBACK: WritebackConfig = {
  enabled: false,
  formType: 'CUS',
  fields: {},
};

/** Default form type per sync entity */
const ENTITY_FORM_TYPES: Record<string, string> = {
  customers: 'CUS',
  suppliers: 'SUP',
  accounts: 'CUS',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Map sync entity type to the Connect table entity for field lookups */
const ENTITY_TABLE_MAP: Record<string, string> = {
  customers: 'account',
  suppliers: 'account',
  accounts: 'account',
};

interface ConnectFieldInfo {
  name: string;
  type?: string;
}

export function WritebackPanel({ entityType, fieldMapping }: WritebackPanelProps) {
  const queryClient = useQueryClient();

  // Fetch Connect table fields for the dropdown
  const connectEntityType = ENTITY_TABLE_MAP[entityType] || 'account';
  const { data: connectFieldsRes } = useQuery({
    queryKey: ['connect', 'connect-fields', connectEntityType],
    queryFn: () => getConnectFields(connectEntityType),
  });

  const connectFields: ConnectFieldInfo[] = useMemo(() => {
    return connectFieldsRes?.data?.fields ?? [];
  }, [connectFieldsRes]);

  // Parse existing writeback config from FieldMapping JSON
  const initial: WritebackConfig = (fieldMapping as Record<string, unknown>)?.writebackFields as WritebackConfig
    ?? { ...DEFAULT_WRITEBACK, formType: ENTITY_FORM_TYPES[entityType] || 'CUS' };

  const [config, setConfig] = useState<WritebackConfig>(initial);
  const [isDirty, setIsDirty] = useState(false);
  const [isExpanded, setIsExpanded] = useState(initial.enabled);
  const [newFieldName, setNewFieldName] = useState('');
  const [newConnectField, setNewConnectField] = useState('');

  // Save mutation — merges writebackFields into the existing FieldMapping JSON
  const saveMut = useMutation({
    mutationFn: () => {
      const existing = (fieldMapping as Record<string, unknown>) ?? {};
      const merged = { ...existing, writebackFields: config };
      return updateConnectEntityConfig(entityType, { FieldMapping: merged });
    },
    onSuccess: () => {
      toast.success(`Writeback config saved for ${entityType}`);
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ['connect', 'config'] });
    },
    onError: (err: Error) => {
      toast.error(`Failed to save: ${err.message}`);
    },
  });

  const update = (changes: Partial<WritebackConfig>) => {
    setConfig(prev => ({ ...prev, ...changes }));
    setIsDirty(true);
  };

  const handleAddField = () => {
    if (!newFieldName.trim() || !newConnectField.trim()) return;
    update({
      fields: {
        ...config.fields,
        [newFieldName.trim()]: { connectField: newConnectField.trim(), type: 'alpha', description: '' },
      },
    });
    setNewFieldName('');
    setNewConnectField('');
  };

  const handleRemoveField = (fieldName: string) => {
    const fields = { ...config.fields };
    delete fields[fieldName];
    update({ fields });
  };

  const handleFieldChange = (fieldName: string, key: keyof WritebackFieldConfig, value: string) => {
    update({
      fields: {
        ...config.fields,
        [fieldName]: { ...config.fields[fieldName], [key]: value },
      },
    });
  };

  const fieldCount = Object.keys(config.fields).length;

  return (
    <div className="rounded-lg border border-border bg-surface-raised">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-semantic-text-default hover:bg-interactive-hover rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <span>ERP Custom Form Writeback</span>
          {config.enabled && (
            <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-medium">
              Active
            </span>
          )}
        </div>
        <span className="text-xs text-semantic-text-faint">
          {fieldCount} field{fieldCount !== 1 ? 's' : ''}
        </span>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {/* Enable toggle and form type */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={() => update({ enabled: !config.enabled })}
                className="rounded border-border text-primary focus:ring-primary/30"
              />
              <span className="text-semantic-text-secondary">Enabled</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-semantic-text-faint">Form Type:</span>
              <select
                value={config.formType}
                onChange={(e) => update({ formType: e.target.value })}
                className="text-xs bg-surface-overlay text-semantic-text-default border border-border rounded px-2 py-1 focus:border-primary focus:outline-none"
              >
                <option value="CUS">CUS (Customer)</option>
                <option value="SUP">SUP (Supplier)</option>
                <option value="STK">STK (Stock)</option>
              </select>
            </div>
            {isDirty && (
              <Button
                size="sm"
                icon={<Save className="w-3.5 h-3.5" />}
                loading={saveMut.isPending}
                onClick={() => saveMut.mutate()}
                className="ml-auto"
              >
                Save Writeback
              </Button>
            )}
          </div>

          {/* Field list */}
          {fieldCount > 0 && (
            <div className="rounded border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface-overlay">
                    <th className="px-3 py-1.5 text-left text-semantic-text-faint font-medium">SYSPRO Field</th>
                    <th className="px-3 py-1.5 text-left text-semantic-text-faint font-medium">Connect Source</th>
                    <th className="px-3 py-1.5 text-left text-semantic-text-faint font-medium">Type</th>
                    <th className="px-3 py-1.5 text-left text-semantic-text-faint font-medium">Description</th>
                    <th className="px-2 py-1.5 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {Object.entries(config.fields).map(([fieldName, fieldConfig]) => (
                    <tr key={fieldName}>
                      <td className="px-3 py-1.5 text-semantic-text-default font-mono">{fieldName}</td>
                      <td className="px-3 py-1.5">
                        <select
                          value={fieldConfig.connectField}
                          onChange={(e) => handleFieldChange(fieldName, 'connectField', e.target.value)}
                          className="w-full text-xs bg-surface-overlay text-semantic-text-default border border-border rounded px-2 py-1 font-mono focus:border-primary focus:outline-none"
                        >
                          <option value="">-- Select field --</option>
                          {connectFields.map(f => (
                            <option key={f.name} value={f.name}>{f.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          value={fieldConfig.type || 'alpha'}
                          onChange={(e) => handleFieldChange(fieldName, 'type', e.target.value)}
                          className="text-xs bg-surface-overlay text-semantic-text-default border border-border rounded px-2 py-1 focus:border-primary focus:outline-none"
                        >
                          <option value="alpha">Alpha</option>
                          <option value="numeric">Numeric</option>
                          <option value="date">Date</option>
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="text"
                          value={fieldConfig.description || ''}
                          onChange={(e) => handleFieldChange(fieldName, 'description', e.target.value)}
                          className="w-full text-xs bg-surface-overlay text-semantic-text-default border border-border rounded px-2 py-1 focus:border-primary focus:outline-none"
                          placeholder="Description..."
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          onClick={() => handleRemoveField(fieldName)}
                          className="text-semantic-text-faint hover:text-danger transition-colors"
                          title="Remove field"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add new field */}
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              placeholder="SYSPRO field (e.g., TER001)"
              className="flex-1 text-xs bg-surface-overlay text-semantic-text-default border border-border rounded px-2 py-1.5 font-mono focus:border-primary focus:outline-none"
            />
            <span className="text-semantic-text-faint text-xs">&larr;</span>
            <select
              value={newConnectField}
              onChange={(e) => setNewConnectField(e.target.value)}
              className="flex-1 text-xs bg-surface-overlay text-semantic-text-default border border-border rounded px-2 py-1.5 font-mono focus:border-primary focus:outline-none"
            >
              <option value="">-- Connect field --</option>
              {connectFields.map(f => (
                <option key={f.name} value={f.name}>{f.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddField}
              disabled={!newFieldName.trim() || !newConnectField.trim()}
              className="text-primary hover:text-primary/80 disabled:text-semantic-text-disabled transition-colors"
              title="Add writeback field"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
