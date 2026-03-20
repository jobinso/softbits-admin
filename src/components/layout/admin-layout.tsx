import { useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './sidebar';
import Header from './header';
import { useSidebar } from '@/hooks/use-sidebar';
import { CommandPalette, useCommandPalette } from '@shared/components';
import type { CommandItem } from '@shared/components';

export default function AdminLayout() {
  const { isCollapsed } = useSidebar();
  const [isPaletteOpen, setIsPaletteOpen] = useCommandPalette();
  const navigate = useNavigate();

  const commandItems: CommandItem[] = useCallback(() => [
    { id: 'nav-dashboard', label: 'Dashboard', group: 'Navigate', onSelect: () => navigate('/') },
    { id: 'nav-security', label: 'Security', group: 'Navigate', onSelect: () => navigate('/security') },
    { id: 'nav-services', label: 'Services', group: 'Navigate', onSelect: () => navigate('/services') },
    { id: 'nav-cache', label: 'Cache', group: 'Navigate', onSelect: () => navigate('/cache') },
    { id: 'nav-config', label: 'Configuration', group: 'Navigate', onSelect: () => navigate('/config') },
    { id: 'nav-licensing', label: 'Licensing', group: 'Navigate', onSelect: () => navigate('/licensing') },
    { id: 'nav-patches', label: 'Patches', group: 'Navigate', onSelect: () => navigate('/patches') },
    { id: 'nav-connect', label: 'ConnectIT Admin', group: 'Apps', onSelect: () => navigate('/apps/connect') },
    { id: 'nav-stack', label: 'StackIT Admin', group: 'Apps', onSelect: () => navigate('/apps/stack') },
    { id: 'nav-flip', label: 'FlipIT Admin', group: 'Apps', onSelect: () => navigate('/apps/flip') },
    { id: 'nav-floor', label: 'FloorIT Admin', group: 'Apps', onSelect: () => navigate('/apps/floor') },
    { id: 'nav-shop', label: 'ShopIT Admin', group: 'Apps', onSelect: () => navigate('/apps/shop') },
    { id: 'nav-infuse', label: 'InfuseIT Admin', group: 'Apps', onSelect: () => navigate('/apps/infuse') },
    { id: 'nav-pulp', label: 'PulpIT Admin', group: 'Apps', onSelect: () => navigate('/apps/pulp') },
    { id: 'nav-labels', label: 'Labels Admin', group: 'Apps', onSelect: () => navigate('/apps/labels') },
    { id: 'nav-work', label: 'WorkIT Admin', group: 'Apps', onSelect: () => navigate('/apps/work') },
  ], [navigate])();

  return (
    <div className="flex h-screen bg-surface-base overflow-hidden">
      <Sidebar />
      <div
        className="flex-1 flex flex-col min-w-0 transition-all duration-200 ease-in-out"
        style={{ marginLeft: isCollapsed ? 64 : 240 }}
      >
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
      <CommandPalette
        items={commandItems}
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        placeholder="Search pages, apps, actions..."
      />
    </div>
  );
}
