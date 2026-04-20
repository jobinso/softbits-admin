import { useMemo, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Constants (mirrored from admin-security.js)
// ---------------------------------------------------------------------------

const AVAILABLE_TABS: Array<{ id: string; name: string; category: string }> = [
  { id: 'bridgedashboard', name: 'Bridge Dashboard', category: 'Bridge' },
  { id: 'security', name: 'Security', category: 'Bridge' },
  { id: 'services', name: 'Services', category: 'Bridge' },
  { id: 'cache', name: 'Cache', category: 'Bridge' },
  { id: 'config', name: 'Config', category: 'Bridge' },
  { id: 'licensing', name: 'Licensing', category: 'Bridge' },
  { id: 'patches', name: 'Updates', category: 'Bridge' },
  { id: 'providers', name: 'Providers', category: 'Bridge' },
  { id: 'labelit', name: 'LabelIT', category: 'Applications' },
  { id: 'stackit', name: 'StackIT', category: 'Applications' },
  { id: 'workit', name: 'InfuseIT - Work', category: 'Applications' },
  { id: 'connectit', name: 'ConnectIT', category: 'Applications' },
  { id: 'flipit', name: 'FlipIT', category: 'Applications' },
  { id: 'floorit', name: 'FloorIT', category: 'Applications' },
  { id: 'infuseit', name: 'InfuseIT - MCP', category: 'Applications' },
  { id: 'shopit', name: 'ShopIT', category: 'Applications' },
  { id: 'pulpit', name: 'PulpIT', category: 'Applications' },
  { id: 'edit', name: 'EdIT', category: 'Applications' },
  { id: 'email-poller', name: 'PollIT', category: 'Applications' },
  { id: 'castit', name: 'CastIT', category: 'Applications' },
];

const ENTITY_PERM_ENTITIES: Array<{ id: string; label: string }> = [
  { id: 'customer', label: 'Customer' },
  { id: 'supplier', label: 'Supplier' },
  { id: 'sales_order', label: 'Sales Order' },
  { id: 'purchase_order', label: 'Purchase Order' },
  { id: 'requisition', label: 'Requisition' },
  { id: 'dispatch', label: 'Dispatch' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'bom', label: 'Bill of Materials' },
  { id: 'wip_job', label: 'WIP Job' },
  { id: 'mrp', label: 'MRP' },
  { id: 'gl_history', label: 'GL History' },
  { id: 'cash_book', label: 'Cash Book' },
  { id: 'contact', label: 'Contact' },
  { id: 'lot', label: 'Lot' },
  { id: 'serial', label: 'Serial' },
];

const ENTITY_PERM_ACTIONS = ['get', 'browse', 'post', 'build'] as const;

const CATEGORY_COLORS: Record<string, string> = {
  Bridge: 'text-primary',
  Applications: 'text-purple-400',
};

// ---------------------------------------------------------------------------
// AllowedTabsGrid
// ---------------------------------------------------------------------------

export function AllowedTabsGrid({
  selectedTabs,
  onToggle,
}: {
  selectedTabs: string[];
  onToggle: (tabId: string) => void;
}) {
  const grouped = useMemo(() => {
    const map: Record<string, typeof AVAILABLE_TABS> = {};
    for (const tab of AVAILABLE_TABS) {
      if (!map[tab.category]) map[tab.category] = [];
      map[tab.category].push(tab);
    }
    return map;
  }, []);

  return (
    <div className="grid grid-cols-2 gap-6">
      {Object.entries(grouped).map(([category, tabs]) => (
        <div key={category}>
          <div className="flex items-center gap-2 mb-2 pb-1 border-b border-border">
            <div className={`w-2.5 h-2.5 rounded-full ${category === 'Bridge' ? 'bg-primary' : 'bg-purple-400'}`} />
            <span className={`text-xs font-semibold uppercase tracking-wide ${CATEGORY_COLORS[category] || 'text-semantic-text-faint'}`}>
              {category}
            </span>
          </div>
          <div className="space-y-1.5 pl-4">
            {tabs.map((tab) => (
              <label
                key={tab.id}
                className="flex items-center justify-between px-3 py-1.5 rounded-md bg-surface-overlay/40 hover:bg-interactive-hover cursor-pointer transition-colors"
              >
                <span className="text-sm text-semantic-text-secondary">{tab.name}</span>
                <input
                  type="checkbox"
                  checked={selectedTabs.includes(tab.id)}
                  onChange={() => onToggle(tab.id)}
                  className="rounded border-border bg-surface-subtle text-primary focus:ring-interactive-focus-ring"
                />
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PermissionMatrix
// ---------------------------------------------------------------------------

interface PermissionMatrixProps {
  permissions: Record<string, string[]>;
  onChange: (permissions: Record<string, string[]>) => void;
}

export function PermissionMatrix({ permissions, onChange }: PermissionMatrixProps) {
  const wildcard = useMemo(() => {
    if (Object.keys(permissions).length === 0) return false;
    return ENTITY_PERM_ENTITIES.every(entity => {
      const perms = permissions[entity.id];
      return perms && ENTITY_PERM_ACTIONS.every(action => perms.includes(action));
    });
  }, [permissions]);

  const toggleWildcard = useCallback(
    (checked: boolean) => {
      if (checked) {
        const allPerms: Record<string, string[]> = {};
        for (const entity of ENTITY_PERM_ENTITIES) {
          allPerms[entity.id] = [...ENTITY_PERM_ACTIONS];
        }
        onChange(allPerms);
      } else {
        onChange({});
      }
    },
    [onChange]
  );

  const togglePermission = useCallback(
    (entityId: string, action: string) => {
      const current = permissions[entityId] || [];
      let next: string[];
      if (current.includes(action)) {
        next = current.filter((a) => a !== action);
      } else {
        next = [...current, action];
      }

      const updated = { ...permissions };
      if (next.length > 0) {
        updated[entityId] = next;
      } else {
        delete updated[entityId];
      }
      onChange(updated);
    },
    [permissions, onChange]
  );

  return (
    <div>
      {/* Wildcard toggle */}
      <label className="flex items-center gap-2 mb-3 text-sm text-semantic-text-subtle cursor-pointer">
        <input
          type="checkbox"
          checked={wildcard}
          onChange={(e) => toggleWildcard(e.target.checked)}
          className="rounded border-border bg-surface-subtle text-primary focus:ring-interactive-focus-ring"
        />
        Select All (grant full access to all entities)
      </label>

      {/* Matrix table */}
      {!wildcard && (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-overlay">
                <th className="text-left px-3 py-2 text-xs font-medium text-semantic-text-faint uppercase tracking-wider">
                  Entity
                </th>
                {ENTITY_PERM_ACTIONS.map((action) => (
                  <th
                    key={action}
                    className="text-center px-2 py-2 text-xs font-medium text-semantic-text-faint uppercase tracking-wider w-20"
                  >
                    {action}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ENTITY_PERM_ENTITIES.map((entity, idx) => {
                const allowed = permissions[entity.id] || [];
                return (
                  <tr
                    key={entity.id}
                    className={idx % 2 === 0 ? 'bg-surface-raised' : 'bg-surface-raised/50'}
                  >
                    <td className="px-3 py-2 text-semantic-text-secondary">{entity.label}</td>
                    {ENTITY_PERM_ACTIONS.map((action) => (
                      <td key={action} className="text-center px-2 py-2">
                        <input
                          type="checkbox"
                          checked={allowed.includes(action)}
                          onChange={() => togglePermission(entity.id, action)}
                          className="rounded border-border bg-surface-subtle text-primary focus:ring-interactive-focus-ring cursor-pointer"
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
