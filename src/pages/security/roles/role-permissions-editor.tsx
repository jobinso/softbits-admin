import { useMemo } from 'react';

// ---------------------------------------------------------------------------
// AllowedTabsGrid — controls which admin console tabs the role can see.
// Entity x action access lives in the Access tab (see access-page.tsx),
// not here.
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

const CATEGORY_COLORS: Record<string, string> = {
  Bridge: 'text-primary',
  Applications: 'text-purple-400',
};

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
