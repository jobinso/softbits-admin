import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Save, RotateCcw, Trash2, Plus, X, Link2 } from 'lucide-react';
import { Card, Button, StatusBadge, Modal } from '@/components/shared';
import { useModal } from '@shared/hooks';
import {
  getConnectSysproFields,
  getConnectFields,
  saveConnectMappingOverrides,
  resetConnectMapping,
} from '@/services/admin-service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FieldDef {
  connect: string;
  type?: string;
  required?: boolean;
  description?: string;
  transform?: string;
  valueMap?: Record<string, string>;
  fixedValue?: string;
  defaultValue?: string;
}

interface EntityDef {
  sysproTable: string;
  connectTable: string;
  keyField?: { syspro: string; connect: string };
  fields: Record<string, FieldDef>;
}

interface BaseMapping {
  description?: string;
  version?: string;
  entities: Record<string, EntityDef>;
}

interface FieldMappingEditorProps {
  entityType: string;
  baseMapping: BaseMapping;
  customOverrides: unknown;
}

interface WorkingMapping {
  connect: string;
  type: string;
  required: boolean;
  description: string;
  transform: string;
  valueMap: Record<string, string>;
  fixedValue: string;
  defaultValue: string;
  isCustom: boolean;
  isDisabled: boolean;
}

interface SysproFieldInfo {
  name: string;
  connectField?: string;
  type?: string;
  required?: boolean;
  description?: string;
}

interface ConnectFieldInfo {
  name: string;
  type?: string;
  sqlType?: string;
  maxLength?: number;
  nullable?: boolean;
}

interface LinePosition {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  sysproField: string;
}

interface CustomOverrides {
  overrides?: Record<string, Partial<FieldDef>>;
  disabled?: string[];
  custom?: Record<string, FieldDef>;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildWorkingMappings(
  entityFields: Record<string, FieldDef>,
  overrides: CustomOverrides | null
): Record<string, WorkingMapping> {
  const result: Record<string, WorkingMapping> = {};
  const disabled = new Set(overrides?.disabled ?? []);

  // Base fields
  for (const [sysproField, def] of Object.entries(entityFields)) {
    const override = overrides?.overrides?.[sysproField];
    result[sysproField] = {
      connect: override?.connect ?? def.connect ?? '',
      type: override?.type ?? def.type ?? 'string',
      required: override?.required ?? def.required ?? false,
      description: override?.description ?? def.description ?? '',
      transform: override?.transform ?? def.transform ?? '',
      valueMap: { ...(def.valueMap ?? {}), ...(override?.valueMap ?? {}) },
      fixedValue: override?.fixedValue ?? def.fixedValue ?? '',
      defaultValue: override?.defaultValue ?? def.defaultValue ?? '',
      isCustom: false,
      isDisabled: disabled.has(sysproField),
    };
  }

  // Custom fields
  if (overrides?.custom) {
    for (const [sysproField, def] of Object.entries(overrides.custom)) {
      result[sysproField] = {
        connect: def.connect ?? '',
        type: def.type ?? 'string',
        required: def.required ?? false,
        description: def.description ?? '',
        transform: def.transform ?? '',
        valueMap: def.valueMap ?? {},
        fixedValue: def.fixedValue ?? '',
        defaultValue: def.defaultValue ?? '',
        isCustom: true,
        isDisabled: false,
      };
    }
  }

  return result;
}

function computeOverridesPayload(
  baseFields: Record<string, FieldDef>,
  working: Record<string, WorkingMapping>
): { overrides: Record<string, Partial<FieldDef>>; disabled: string[]; custom: Record<string, FieldDef> } {
  const overrides: Record<string, Partial<FieldDef>> = {};
  const disabled: string[] = [];
  const custom: Record<string, FieldDef> = {};

  for (const [field, wm] of Object.entries(working)) {
    if (wm.isCustom) {
      custom[field] = {
        connect: wm.connect,
        type: wm.type,
        required: wm.required,
        description: wm.description,
        ...(wm.transform ? { transform: wm.transform } : {}),
        ...(Object.keys(wm.valueMap).length > 0 ? { valueMap: wm.valueMap } : {}),
        ...(wm.fixedValue ? { fixedValue: wm.fixedValue } : {}),
        ...(wm.defaultValue ? { defaultValue: wm.defaultValue } : {}),
      };
      continue;
    }

    if (wm.isDisabled) {
      disabled.push(field);
      continue;
    }

    const base = baseFields[field];
    if (!base) continue;

    const diff: Partial<FieldDef> = {};
    if (wm.connect !== (base.connect ?? '')) diff.connect = wm.connect;
    if (wm.transform !== (base.transform ?? '')) diff.transform = wm.transform;
    if (wm.fixedValue !== (base.fixedValue ?? '')) diff.fixedValue = wm.fixedValue;
    if (wm.defaultValue !== (base.defaultValue ?? '')) diff.defaultValue = wm.defaultValue;
    if (JSON.stringify(wm.valueMap) !== JSON.stringify(base.valueMap ?? {})) diff.valueMap = wm.valueMap;

    if (Object.keys(diff).length > 0) {
      overrides[field] = diff;
    }
  }

  return { overrides, disabled, custom };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: string }) {
  const colorMap: Record<string, string> = {
    string: 'bg-blue-500/10 text-blue-400',
    integer: 'bg-amber-500/10 text-amber-400',
    decimal: 'bg-amber-500/10 text-amber-400',
    boolean: 'bg-purple-500/10 text-purple-400',
    datetime: 'bg-green-500/10 text-green-400',
    date: 'bg-green-500/10 text-green-400',
    guid: 'bg-pink-500/10 text-pink-400',
  };
  const cls = colorMap[type] || 'bg-surface-overlay text-semantic-text-subtle';
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cls}`}>
      {type || 'string'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Detail panel (editable)
// ---------------------------------------------------------------------------

interface DetailPanelProps {
  sysproField: string;
  mapping: WorkingMapping;
  onUpdate: (field: string, changes: Partial<WorkingMapping>) => void;
  onDelete: (field: string) => void;
  onClose: () => void;
}

function DetailPanel({ sysproField, mapping, onUpdate, onDelete, onClose }: DetailPanelProps) {
  const [newMapKey, setNewMapKey] = useState('');
  const [newMapValue, setNewMapValue] = useState('');

  const handleAddValueMapEntry = () => {
    if (!newMapKey.trim()) return;
    const updated = { ...mapping.valueMap, [newMapKey.trim()]: newMapValue };
    onUpdate(sysproField, { valueMap: updated });
    setNewMapKey('');
    setNewMapValue('');
  };

  const handleRemoveValueMapEntry = (key: string) => {
    const updated = { ...mapping.valueMap };
    delete updated[key];
    onUpdate(sysproField, { valueMap: updated });
  };

  return (
    <div className="mt-4 rounded-lg border border-primary/30 bg-surface-raised p-4 animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-semantic-text-default">Mapping Detail</h4>
        <div className="flex items-center gap-2">
          {mapping.isCustom && (
            <StatusBadge status="custom" label="Custom" />
          )}
          {mapping.isDisabled && (
            <StatusBadge status="disabled" label="Disabled" />
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-semantic-text-subtle hover:text-semantic-text-default text-xs px-2 py-1 rounded hover:bg-interactive-hover transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Source / Destination read-only display */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-semantic-text-faint text-xs block mb-1">Source (ERP)</span>
          <code className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-medium">{sysproField}</code>
        </div>
        <div>
          <span className="text-semantic-text-faint text-xs block mb-1">Destination (Connect)</span>
          <code className="text-xs bg-surface-overlay text-semantic-text-subtle px-2 py-1 rounded font-medium">{mapping.connect || '(unmapped)'}</code>
        </div>
        <div>
          <span className="text-semantic-text-faint text-xs block mb-1">Type</span>
          <TypeBadge type={mapping.type} />
        </div>
        <div>
          <span className="text-semantic-text-faint text-xs block mb-1">Required</span>
          {mapping.required
            ? <span className="text-primary font-semibold text-xs">Yes</span>
            : <span className="text-semantic-text-disabled text-xs">No</span>
          }
        </div>
      </div>

      {mapping.description && (
        <div className="mt-3">
          <span className="text-semantic-text-faint text-xs block mb-1">Description</span>
          <p className="text-sm text-semantic-text-secondary">{mapping.description}</p>
        </div>
      )}

      {/* Editable properties */}
      <div className="mt-3 pt-3 border-t border-border space-y-3">
        {/* Transform */}
        <div>
          <label className="text-semantic-text-faint text-xs block mb-1">Transform</label>
          <input
            type="text"
            value={mapping.transform}
            onChange={(e) => onUpdate(sysproField, { transform: e.target.value })}
            placeholder="e.g. trim().toUpperCase()"
            className="w-full text-xs bg-surface-overlay text-semantic-text-default border border-border rounded px-3 py-2 font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>

        {/* Value Map */}
        <div>
          <label className="text-semantic-text-faint text-xs block mb-1">Value Map</label>
          {Object.keys(mapping.valueMap).length > 0 && (
            <div className="rounded border border-border overflow-hidden mb-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface-overlay">
                    <th className="px-3 py-1.5 text-left text-semantic-text-faint font-medium">Source Value</th>
                    <th className="px-3 py-1.5 text-left text-semantic-text-faint font-medium">Mapped Value</th>
                    <th className="px-2 py-1.5 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {Object.entries(mapping.valueMap).map(([key, val]) => (
                    <tr key={key}>
                      <td className="px-3 py-1.5 text-semantic-text-default font-mono">{key}</td>
                      <td className="px-3 py-1.5 text-semantic-text-secondary font-mono">{val}</td>
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          onClick={() => handleRemoveValueMapEntry(key)}
                          className="text-semantic-text-faint hover:text-danger transition-colors"
                          title="Remove entry"
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
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={newMapKey}
              onChange={(e) => setNewMapKey(e.target.value)}
              placeholder="Source value"
              className="flex-1 text-xs bg-surface-overlay text-semantic-text-default border border-border rounded px-2 py-1.5 font-mono focus:border-primary focus:outline-none"
            />
            <span className="text-semantic-text-faint text-xs">&rarr;</span>
            <input
              type="text"
              value={newMapValue}
              onChange={(e) => setNewMapValue(e.target.value)}
              placeholder="Mapped value"
              className="flex-1 text-xs bg-surface-overlay text-semantic-text-default border border-border rounded px-2 py-1.5 font-mono focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAddValueMapEntry}
              disabled={!newMapKey.trim()}
              className="text-primary hover:text-primary/80 disabled:text-semantic-text-disabled transition-colors"
              title="Add entry"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Fixed Value */}
        <div>
          <label className="text-semantic-text-faint text-xs block mb-1">Fixed Value</label>
          <input
            type="text"
            value={mapping.fixedValue}
            onChange={(e) => onUpdate(sysproField, { fixedValue: e.target.value })}
            placeholder="Static value override"
            className="w-full text-xs bg-surface-overlay text-semantic-text-default border border-border rounded px-3 py-2 font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>

        {/* Default Value */}
        <div>
          <label className="text-semantic-text-faint text-xs block mb-1">Default Value</label>
          <input
            type="text"
            value={mapping.defaultValue}
            onChange={(e) => onUpdate(sysproField, { defaultValue: e.target.value })}
            placeholder="Fallback when source is empty"
            className="w-full text-xs bg-surface-overlay text-semantic-text-default border border-border rounded px-3 py-2 font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>

        {/* Delete */}
        <div className="pt-2 border-t border-border">
          <Button
            variant="danger"
            size="sm"
            icon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={() => onDelete(sysproField)}
          >
            {mapping.isCustom ? 'Remove Mapping' : 'Disable Mapping'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Entity visual mapping view
// ---------------------------------------------------------------------------

interface EntityMappingViewProps {
  entity: EntityDef;
  entityName: string;
  entityType: string;
  workingMappings: Record<string, WorkingMapping>;
  selectedMapping: string | null;
  linkMode: boolean;
  selectedSysproField: string | null;
  sysproFields: SysproFieldInfo[];
  connectFields: ConnectFieldInfo[];
  onSelectMapping: (field: string | null) => void;
  onSelectSysproForLink: (field: string) => void;
  onSelectConnectForLink: (field: string) => void;
  onUpdateMapping: (field: string, changes: Partial<WorkingMapping>) => void;
  onDeleteMapping: (field: string) => void;
}

function EntityMappingView({
  entity,
  workingMappings,
  selectedMapping,
  linkMode,
  selectedSysproField,
  sysproFields,
  connectFields,
  onSelectMapping,
  onSelectSysproForLink,
  onSelectConnectForLink,
  onUpdateMapping,
  onDeleteMapping,
}: EntityMappingViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const leftRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rightRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [lines, setLines] = useState<LinePosition[]>([]);

  const sysproKeyField = entity.keyField?.syspro || '';
  const connectKeyField = entity.keyField?.connect || '';

  // All SYSPRO field names: from API fields + any from working mappings (custom ones)
  const allSysproFieldNames = useMemo(() => {
    const fromApi = new Set(sysproFields.map(f => f.name));
    const fromMappings = new Set(Object.keys(workingMappings));
    return [...new Set([...fromApi, ...fromMappings])];
  }, [sysproFields, workingMappings]);

  // All Connect field names: from API fields
  const allConnectFieldNames = useMemo(() => {
    return connectFields.map(f => f.name);
  }, [connectFields]);

  // Which connect fields are mapped
  const mappedConnectFields = useMemo(() => {
    const mapped = new Set<string>();
    for (const wm of Object.values(workingMappings)) {
      if (wm.connect && !wm.isDisabled) mapped.add(wm.connect);
    }
    return mapped;
  }, [workingMappings]);

  // Which syspro fields are mapped
  const mappedSysproFields = useMemo(() => {
    const mapped = new Set<string>();
    for (const [field, wm] of Object.entries(workingMappings)) {
      if (wm.connect && !wm.isDisabled) mapped.add(field);
    }
    return mapped;
  }, [workingMappings]);

  const calculateLines = useCallback(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg) return;

    const containerRect = container.getBoundingClientRect();
    const newLines: LinePosition[] = [];

    for (const [sysproField, wm] of Object.entries(workingMappings)) {
      if (wm.isDisabled || !wm.connect) continue;
      const leftEl = leftRefs.current[sysproField];
      const rightEl = rightRefs.current[wm.connect];
      if (!leftEl || !rightEl) continue;

      const leftRect = leftEl.getBoundingClientRect();
      const rightRect = rightEl.getBoundingClientRect();

      newLines.push({
        x1: leftRect.right - containerRect.left,
        y1: leftRect.top + leftRect.height / 2 - containerRect.top,
        x2: rightRect.left - containerRect.left,
        y2: rightRect.top + rightRect.height / 2 - containerRect.top,
        sysproField,
      });
    }

    setLines(newLines);
  }, [workingMappings]);

  useEffect(() => {
    calculateLines();
    const t1 = setTimeout(calculateLines, 100);
    const t2 = setTimeout(calculateLines, 300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [calculateLines]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => calculateLines());
    observer.observe(container);
    return () => observer.disconnect();
  }, [calculateLines]);

  const handleLeftClick = (sysproField: string) => {
    const wm = workingMappings[sysproField];
    if (wm && wm.connect && !wm.isDisabled) {
      // Already mapped — select this mapping
      onSelectMapping(selectedMapping === sysproField ? null : sysproField);
    } else {
      // Not mapped — enter link mode
      onSelectSysproForLink(sysproField);
    }
  };

  const handleRightClick = (connectField: string) => {
    if (linkMode && selectedSysproField) {
      // Complete the link
      onSelectConnectForLink(connectField);
    } else {
      // Find the mapping that targets this connect field and select it
      const entry = Object.entries(workingMappings).find(
        ([, wm]) => wm.connect === connectField && !wm.isDisabled
      );
      if (entry) {
        onSelectMapping(selectedMapping === entry[0] ? null : entry[0]);
      }
    }
  };

  const handleLineClick = (sysproField: string) => {
    onSelectMapping(selectedMapping === sysproField ? null : sysproField);
  };

  const selectedMappingData = selectedMapping ? workingMappings[selectedMapping] : null;

  return (
    <div>
      {/* Link mode banner */}
      {linkMode && selectedSysproField && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-md border border-primary/40 bg-primary/5 text-sm text-primary animate-in fade-in duration-150">
          <Link2 className="w-4 h-4 shrink-0" />
          <span>
            Selected <code className="font-semibold">{selectedSysproField}</code> — click a Connect field on the right to create a mapping
          </span>
          <button
            type="button"
            onClick={() => onSelectSysproForLink('')}
            className="ml-auto text-xs text-semantic-text-subtle hover:text-semantic-text-default"
          >
            Cancel
          </button>
        </div>
      )}

      <div ref={containerRef} className="relative flex gap-0 min-h-[200px]">
        {/* Left panel — ERP / SYSPRO fields */}
        <div className="w-[280px] shrink-0 space-y-1.5 py-2 pr-4 z-10">
          <div className="text-[10px] font-semibold text-semantic-text-faint uppercase tracking-wider mb-2 px-1">
            ERP / SYSPRO
          </div>
          {allSysproFieldNames.map(fieldName => {
            const wm = workingMappings[fieldName];
            const isMapped = mappedSysproFields.has(fieldName);
            const isSelected = selectedMapping === fieldName;
            const isKey = fieldName === sysproKeyField;
            const isLinkSource = linkMode && selectedSysproField === fieldName;
            const isDisabled = wm?.isDisabled;

            return (
              <div
                key={fieldName}
                ref={el => { leftRefs.current[fieldName] = el; }}
                role="button"
                tabIndex={0}
                onClick={() => handleLeftClick(fieldName)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleLeftClick(fieldName); }}
                className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-all text-sm ${
                  isDisabled
                    ? 'border-border/50 bg-surface-raised/50 text-semantic-text-disabled line-through opacity-40'
                    : isLinkSource
                      ? 'border-primary bg-primary/15 text-primary ring-1 ring-primary/40'
                      : isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : isKey
                          ? 'border-amber-500/60 bg-amber-500/10 text-amber-300 hover:border-amber-400'
                          : isMapped
                            ? 'border-border bg-surface-raised hover:border-primary/40 text-semantic-text-default'
                            : 'border-border/60 bg-surface-raised hover:border-primary/40 text-semantic-text-default opacity-50'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isKey && <span className="text-amber-400 text-[10px] shrink-0" title="Primary Key">PK</span>}
                  {isMapped && !isKey && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" title="Mapped" />}
                  <code className="text-xs font-medium truncate">{fieldName}</code>
                  {wm?.required && <span className="text-[10px] text-danger shrink-0">*</span>}
                  {wm?.isCustom && <span className="text-[9px] bg-primary/20 text-primary px-1 rounded shrink-0">custom</span>}
                </div>
                <TypeBadge type={wm?.type || 'string'} />
              </div>
            );
          })}
        </div>

        {/* SVG connection lines */}
        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-0"
          style={{ overflow: 'visible' }}
        >
          {lines.map(line => {
            const isSelected = selectedMapping === line.sysproField;
            const isKey = line.sysproField === sysproKeyField;
            const controlOffset = Math.min(Math.abs(line.x2 - line.x1) * 0.45, 120);
            const path = `M ${line.x1},${line.y1} C ${line.x1 + controlOffset},${line.y1} ${line.x2 - controlOffset},${line.y2} ${line.x2},${line.y2}`;

            let stroke = '#475569';
            let strokeW = 1;
            let opacity = 0.6;

            if (isSelected) {
              stroke = '#00d4aa';
              strokeW = 2.5;
              opacity = 1;
            } else if (isKey) {
              stroke = '#f59e0b';
              strokeW = 1.5;
              opacity = 0.8;
            }

            return (
              <g key={line.sysproField}>
                {/* Invisible wider hit area for clicking */}
                <path
                  d={path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={12}
                  className="pointer-events-auto cursor-pointer"
                  onClick={() => handleLineClick(line.sysproField)}
                />
                <path
                  d={path}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={strokeW}
                  strokeOpacity={opacity}
                  className="transition-all duration-200"
                />
              </g>
            );
          })}
        </svg>

        {/* Center spacer for lines */}
        <div className="flex-1 min-w-[80px]" />

        {/* Right panel — Connect / CRM fields */}
        <div className="w-[280px] shrink-0 space-y-1.5 py-2 pl-4 z-10">
          <div className="text-[10px] font-semibold text-semantic-text-faint uppercase tracking-wider mb-2 px-1">
            Connect / CRM
          </div>
          {allConnectFieldNames.map(fieldName => {
            const isMapped = mappedConnectFields.has(fieldName);
            const isKey = fieldName === connectKeyField;
            const isLinkTarget = linkMode && selectedSysproField;
            // Find the syspro field mapped to this connect field
            const mappedEntry = Object.entries(workingMappings).find(
              ([, wm]) => wm.connect === fieldName && !wm.isDisabled
            );
            const isSelected = mappedEntry ? selectedMapping === mappedEntry[0] : false;

            return (
              <div
                key={fieldName}
                ref={el => { rightRefs.current[fieldName] = el; }}
                role="button"
                tabIndex={0}
                onClick={() => handleRightClick(fieldName)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleRightClick(fieldName); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-all text-sm ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary'
                    : isLinkTarget && !isMapped
                      ? 'border-primary/50 bg-primary/5 hover:bg-primary/10 hover:border-primary text-semantic-text-default'
                      : isKey
                        ? 'border-amber-500/60 bg-amber-500/10 text-amber-300 hover:border-amber-400'
                        : isMapped
                          ? 'border-border bg-surface-raised hover:border-primary/40 text-semantic-text-default'
                          : 'border-border/60 bg-surface-raised hover:border-primary/40 text-semantic-text-default opacity-50'
                }`}
              >
                {isKey && <span className="text-amber-400 text-[10px] shrink-0" title="Foreign Key">FK</span>}
                {isMapped && !isKey && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" title="Mapped" />}
                <code className="text-xs font-medium truncate">{fieldName}</code>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail panel for selected mapping */}
      {selectedMapping && selectedMappingData && (
        <DetailPanel
          sysproField={selectedMapping}
          mapping={selectedMappingData}
          onUpdate={onUpdateMapping}
          onDelete={onDeleteMapping}
          onClose={() => onSelectMapping(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FieldMappingEditor({ entityType, baseMapping, customOverrides }: FieldMappingEditorProps) {
  const queryClient = useQueryClient();
  const resetModal = useModal();

  const entities = baseMapping?.entities || {};
  const entityNames = Object.keys(entities);
  const [activeEntity, setActiveEntity] = useState<string>(entityNames[0] || '');

  // Working state
  const [workingMappings, setWorkingMappings] = useState<Record<string, WorkingMapping>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [selectedMapping, setSelectedMapping] = useState<string | null>(null);
  const [selectedSysproField, setSelectedSysproField] = useState<string | null>(null);
  const [linkMode, setLinkMode] = useState(false);

  // Initialize working mappings when entity or overrides change
  useEffect(() => {
    const names = Object.keys(baseMapping?.entities || {});
    if (names.length > 0 && !names.includes(activeEntity)) {
      setActiveEntity(names[0]);
    }
  }, [entityType, baseMapping, activeEntity]);

  useEffect(() => {
    const currentEntity = entities[activeEntity];
    if (!currentEntity) return;
    const overrides = (customOverrides as CustomOverrides) ?? null;
    setWorkingMappings(buildWorkingMappings(currentEntity.fields, overrides));
    setIsDirty(false);
    setSelectedMapping(null);
    setSelectedSysproField(null);
    setLinkMode(false);
  }, [activeEntity, baseMapping, customOverrides, entities]);

  // Fetch SYSPRO fields for current entity
  const { data: sysproFieldsRes } = useQuery({
    queryKey: ['connect', 'syspro-fields', entityType, activeEntity],
    queryFn: () => getConnectSysproFields(entityType, activeEntity),
    enabled: !!activeEntity,
  });

  // Fetch Connect fields for current entity type and active sub-entity.
  // When multiple sub-entities exist (e.g. activity: standard/opportunity/case/project),
  // pass activeEntity so the endpoint returns fields from the correct source table.
  const { data: connectFieldsRes } = useQuery({
    queryKey: ['connect', 'connect-fields', entityType, activeEntity],
    queryFn: () => getConnectFields(entityType, activeEntity || undefined),
    enabled: !!entityType,
  });

  const sysproFields: SysproFieldInfo[] = useMemo(() => {
    const data = sysproFieldsRes?.data;
    return data?.fields ?? data?.queryFields ?? [];
  }, [sysproFieldsRes]);

  const connectFieldsList: ConnectFieldInfo[] = useMemo(() => {
    return connectFieldsRes?.data?.fields ?? [];
  }, [connectFieldsRes]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: () => {
      const currentEntity = entities[activeEntity];
      if (!currentEntity) throw new Error('No active entity');
      const payload = computeOverridesPayload(currentEntity.fields, workingMappings);
      return saveConnectMappingOverrides(entityType, payload);
    },
    onSuccess: () => {
      toast.success('Mapping overrides saved');
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ['connect', 'mapping-detail', entityType] });
    },
    onError: (err: Error) => {
      toast.error(`Failed to save: ${err.message}`);
    },
  });

  // Reset mutation
  const resetMutation = useMutation({
    mutationFn: () => resetConnectMapping(entityType),
    onSuccess: () => {
      toast.success('Mappings reset to defaults');
      resetModal.close();
      setIsDirty(false);
      setSelectedMapping(null);
      queryClient.invalidateQueries({ queryKey: ['connect', 'mapping-detail', entityType] });
    },
    onError: (err: Error) => {
      toast.error(`Failed to reset: ${err.message}`);
    },
  });

  // Handlers
  const handleUpdateMapping = useCallback((field: string, changes: Partial<WorkingMapping>) => {
    setWorkingMappings(prev => ({
      ...prev,
      [field]: { ...prev[field], ...changes },
    }));
    setIsDirty(true);
  }, []);

  const handleDeleteMapping = useCallback((field: string) => {
    setWorkingMappings(prev => {
      const wm = prev[field];
      if (!wm) return prev;

      if (wm.isCustom) {
        // Remove custom mappings entirely
        const next = { ...prev };
        delete next[field];
        return next;
      }

      // Disable base mappings
      return {
        ...prev,
        [field]: { ...wm, isDisabled: true },
      };
    });
    setIsDirty(true);
    setSelectedMapping(null);
  }, []);

  const handleSelectSysproForLink = useCallback((field: string) => {
    if (!field) {
      setSelectedSysproField(null);
      setLinkMode(false);
      setSelectedMapping(null);
      return;
    }
    setSelectedSysproField(field);
    setLinkMode(true);
    setSelectedMapping(null);
  }, []);

  const handleSelectConnectForLink = useCallback((connectField: string) => {
    if (!selectedSysproField || !linkMode) return;

    const existing = workingMappings[selectedSysproField];
    if (existing) {
      // Update existing mapping's connect target
      handleUpdateMapping(selectedSysproField, { connect: connectField, isDisabled: false });
    } else {
      // Create new custom mapping
      setWorkingMappings(prev => ({
        ...prev,
        [selectedSysproField]: {
          connect: connectField,
          type: 'string',
          required: false,
          description: '',
          transform: '',
          valueMap: {},
          fixedValue: '',
          defaultValue: '',
          isCustom: true,
          isDisabled: false,
        },
      }));
      setIsDirty(true);
    }

    setSelectedSysproField(null);
    setLinkMode(false);
    setSelectedMapping(selectedSysproField);
  }, [selectedSysproField, linkMode, workingMappings, handleUpdateMapping]);

  const handleSelectMapping = useCallback((field: string | null) => {
    setSelectedMapping(field);
    setSelectedSysproField(null);
    setLinkMode(false);
  }, []);

  if (entityNames.length === 0) {
    return (
      <p className="text-center text-semantic-text-faint text-sm py-6">
        No entity mappings found for {entityType}.
      </p>
    );
  }

  const currentEntity = entities[activeEntity];
  const activeMappingCount = Object.values(workingMappings).filter(wm => wm.connect && !wm.isDisabled).length;

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="rounded-lg border border-border bg-surface-raised px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-semantic-text-default capitalize">
              {entityType} Mappings
            </h2>
            <p className="text-xs text-semantic-text-faint mt-0.5">
              {baseMapping.description || ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isDirty && (
              <span className="text-xs text-amber-400 font-medium animate-in fade-in duration-150">
                Unsaved changes
              </span>
            )}
            <code className="text-xs bg-surface-overlay text-semantic-text-subtle px-2 py-1 rounded">
              v{baseMapping.version || '1.0.0'}
            </code>
            <Button
              variant="ghost"
              size="sm"
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={() => resetModal.open()}
              className="text-danger hover:text-danger"
            >
              Reset
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Save className="w-3.5 h-3.5" />}
              disabled={!isDirty}
              loading={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              Save
            </Button>
          </div>
        </div>
      </div>

      {/* Entity tabs */}
      {entityNames.length > 1 && (
        <div className="flex gap-1 border-b border-border">
          {entityNames.map(name => {
            const ent = entities[name];
            const count = Object.keys(ent.fields || {}).length;
            const isActive = name === activeEntity;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setActiveEntity(name)}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-semantic-text-subtle hover:text-semantic-text-default hover:border-border'
                }`}
              >
                {name.charAt(0).toUpperCase() + name.slice(1)}
                <span className="ml-1.5 text-xs text-semantic-text-faint">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Visual mapping card */}
      {currentEntity && (
        <Card
          title={`${activeEntity.charAt(0).toUpperCase() + activeEntity.slice(1)} \u2014 ${currentEntity.sysproTable || ''} \u2192 ${currentEntity.connectTable || ''} \u00B7 ${activeMappingCount} active mappings`}
        >
          <EntityMappingView
            entity={currentEntity}
            entityName={activeEntity}
            entityType={entityType}
            workingMappings={workingMappings}
            selectedMapping={selectedMapping}
            linkMode={linkMode}
            selectedSysproField={selectedSysproField}
            sysproFields={sysproFields}
            connectFields={connectFieldsList}
            onSelectMapping={handleSelectMapping}
            onSelectSysproForLink={handleSelectSysproForLink}
            onSelectConnectForLink={handleSelectConnectForLink}
            onUpdateMapping={handleUpdateMapping}
            onDeleteMapping={handleDeleteMapping}
          />
        </Card>
      )}

      {/* Reset confirmation modal */}
      <Modal
        isOpen={resetModal.isOpen}
        onClose={resetModal.close}
        title="Reset to Defaults"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={resetModal.close}>Cancel</Button>
            <Button variant="danger" onClick={() => resetMutation.mutate()} loading={resetMutation.isPending}>
              Reset All Overrides
            </Button>
          </>
        }
      >
        <p className="text-sm text-semantic-text-secondary">
          This will remove all custom overrides and disabled fields for the <strong className="text-semantic-text-default">{entityType}</strong> mapping,
          reverting to the base JSON configuration.
        </p>
        <p className="text-sm text-semantic-text-faint mt-2">
          This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
