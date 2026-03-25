import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Shield,
  Users,
  KeyRound,
  Smartphone,
  Server,
  Database,
  Settings,
  FolderTree,
  DollarSign,
  List,
  Warehouse,
  Key,
  Package,
  ShoppingCart,
  Factory,
  Tag,
  Store,
  Brain,
  Briefcase,
  FileText,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  FileCode,
  Plug,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { useSidebar } from '@/hooks/use-sidebar';
import { useAuth } from '@/hooks/use-auth';
import { ADMIN_TABS } from '@/utils/constants';
import { getHealth } from '@/services/admin-service';
import type { AppStatus } from '@/types';

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Shield,
  Users,
  KeyRound,
  Smartphone,
  Server,
  Database,
  Settings,
  FolderTree,
  DollarSign,
  List,
  Warehouse,
  Key,
  Package,
  ShoppingCart,
  Factory,
  Tag,
  Store,
  Brain,
  Briefcase,
  FileText,
  FileCode,
  Plug,
};

interface SubNavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
}

interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  children?: SubNavItem[];
}

const BRIDGE_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/' },
  { id: 'security', label: 'Security', icon: 'Shield', path: '/security' },
  { id: 'services', label: 'Services', icon: 'Server', path: '/services' },
  { id: 'cache', label: 'Cache', icon: 'Database', path: '/cache' },
  { id: 'config', label: 'Config', icon: 'Settings', path: '/config' },
  { id: 'erp-config', label: 'ERP Config', icon: 'FileCode', path: '/erp-config' },
  { id: 'licensing', label: 'Licensing', icon: 'Key', path: '/licensing' },
  { id: 'patches', label: 'Patches', icon: 'Package', path: '/patches' },
  { id: 'providers', label: 'Providers', icon: 'Plug', path: '/providers' },
];

function getAppNav(): NavItem[] {
  return ADMIN_TABS.APPS.map((tab) => ({
    id: tab.id,
    label: tab.label,
    icon: tab.icon,
    path: `/apps/${tab.app}`,
  }));
}

function isPathActive(currentPath: string, itemPath: string): boolean {
  if (itemPath === '/') return currentPath === '/';
  return currentPath.startsWith(itemPath);
}

function isParentActive(currentPath: string, item: NavItem): boolean {
  if (item.children) {
    return item.children.some((child) => isPathActive(currentPath, child.path));
  }
  return isPathActive(currentPath, item.path);
}

export default function Sidebar() {
  const { isCollapsed, toggleCollapsed } = useSidebar();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ security: true, config: true, bridge: true, apps: true });
  const [appStatuses, setAppStatuses] = useState<Record<string, AppStatus>>({});
  const [bridgeOnline, setBridgeOnline] = useState(false);
  const [bridgeVersion, setBridgeVersion] = useState('');

  const allowedTabs = user?.AllowedTabs;

  // Fetch app statuses on mount
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await getHealth();
        const data = res.data ?? res;
        setBridgeOnline(true);
        if (data.version) setBridgeVersion(data.version);
        if (data.apps) {
          setAppStatuses(data.apps);
        }
      } catch {
        setBridgeOnline(false);
      }
    };
    fetchHealth();
  }, []);

  // Auto-expand parent sections when a child route is active
  useEffect(() => {
    for (const item of BRIDGE_NAV) {
      if (item.children && isParentActive(location.pathname, item)) {
        setExpandedSections((prev) => ({ ...prev, [item.id]: true }));
      }
    }
  }, [location.pathname]);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isTabAllowed = (tabId: string): boolean => {
    // Dashboard is always visible — it's the landing page
    if (tabId === 'dashboard') return true;
    if (!allowedTabs || allowedTabs.length === 0) return true;
    return allowedTabs.includes(tabId);
  };

  const isAppEnabled = (appName: string): boolean => {
    if (Object.keys(appStatuses).length === 0) return true;
    const status = appStatuses[appName];
    return status ? status.enabled : true;
  };

  // Filter bridge nav by allowed tabs
  const visibleBridgeNav = BRIDGE_NAV.filter((item) => {
    if (item.children) {
      return item.children.some((child) => isTabAllowed(child.id)) || isTabAllowed(item.id);
    }
    return isTabAllowed(item.id);
  });

  // Filter app nav by allowed tabs + enabled apps
  const appNav = getAppNav();
  const visibleAppNav = appNav.filter((item) => {
    const tab = ADMIN_TABS.APPS.find((t) => t.id === item.id);
    if (!tab) return false;
    if (!isAppEnabled(tab.app)) return false;
    return isTabAllowed(item.id);
  });

  const renderNavItem = (item: NavItem) => {
    const Icon = iconMap[item.icon] || LayoutDashboard;
    const hasChildren = item.children && item.children.length > 0;
    const active = hasChildren ? isParentActive(location.pathname, item) : isPathActive(location.pathname, item.path);
    const expanded = expandedSections[item.id];

    // If the parent tab is allowed (e.g. 'security'), show all children.
    // Otherwise, filter children individually by their own IDs.
    const visibleChildren = hasChildren
      ? (isTabAllowed(item.id)
        ? item.children!
        : item.children!.filter((child) => isTabAllowed(child.id)))
      : [];

    return (
      <div key={item.id}>
        <button
          onClick={() => {
            if (hasChildren) {
              if (isCollapsed) {
                navigate(visibleChildren[0]?.path || item.path);
              } else {
                toggleSection(item.id);
                // Navigate to first child if not already in this section
                if (!isParentActive(location.pathname, item) && visibleChildren.length > 0) {
                  navigate(visibleChildren[0].path);
                }
              }
            } else {
              navigate(item.path);
            }
          }}
          title={isCollapsed ? item.label : undefined}
          className={clsx(
            'w-full flex items-center gap-2.5 rounded-lg text-sm font-medium transition-all duration-150',
            isCollapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2',
            active
              ? 'bg-accent-primary-subtle text-accent'
              : 'text-semantic-text-subtle hover:text-semantic-text-default hover:bg-interactive-hover'
          )}
        >
          <Icon className="w-4 h-4 shrink-0" />
          {!isCollapsed && (
            <>
              <span className="flex-1 text-left truncate">{item.label}</span>
              {hasChildren && visibleChildren.length > 0 && (
                expanded
                  ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-semantic-text-subtle" />
                  : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-semantic-text-subtle" />
              )}
            </>
          )}
        </button>

        {/* Sub-navigation */}
        {hasChildren && expanded && !isCollapsed && visibleChildren.length > 0 && (
          <div className="mt-0.5 space-y-0.5">
            {visibleChildren.map((child) => {
              const ChildIcon = iconMap[child.icon] || LayoutDashboard;
              const childActive = isPathActive(location.pathname, child.path);
              return (
                <button
                  key={child.id}
                  onClick={() => navigate(child.path)}
                  className={clsx(
                    'w-full flex items-center gap-2.5 rounded-lg text-sm transition-all duration-150 pl-10 pr-3 py-1.5',
                    childActive
                      ? 'text-accent font-medium'
                      : 'text-semantic-text-subtle hover:text-semantic-text-secondary hover:bg-interactive-hover'
                  )}
                >
                  <ChildIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{child.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={clsx(
        'fixed top-0 left-0 h-screen bg-[var(--sidebar-bg)] border-r border-border flex flex-col z-30',
        'transition-all duration-200 ease-in-out'
      )}
      style={{ width: isCollapsed ? 64 : 240 }}
    >
      {/* Logo */}
      <div
        className={clsx(
          'h-14 flex items-center border-b border-border overflow-hidden shrink-0',
          isCollapsed ? 'justify-center px-2' : 'px-4 gap-2.5'
        )}
      >
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Shield className="w-4 h-4 text-primary" />
        </div>
        {!isCollapsed && (
          <div className="min-w-0 transition-opacity duration-150">
            <h1 className="text-sm font-semibold text-semantic-text-default">
              <span className="text-semantic-text-secondary">Admin</span>
              <span className="text-primary">IT</span>
            </h1>
            <p className="text-[10px] text-semantic-text-subtle">System Administration</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 space-y-1">
        {/* Bridge section — collapsible */}
        {visibleBridgeNav.length > 0 && (
          <>
            {!isCollapsed ? (
              <button
                onClick={() => setExpandedSections((s) => ({ ...s, bridge: !s.bridge }))}
                className="w-full flex items-center justify-between px-3 pb-1 pt-1 group cursor-pointer"
              >
                <span className="text-[10px] uppercase tracking-wider text-semantic-text-subtle font-bold">
                  Bridge
                </span>
                <ChevronDown
                  className={clsx(
                    'w-3 h-3 text-semantic-text-subtle transition-transform duration-150',
                    !expandedSections.bridge && '-rotate-90'
                  )}
                />
              </button>
            ) : null}
            {(isCollapsed || expandedSections.bridge) && visibleBridgeNav.map(renderNavItem)}
          </>
        )}

        {/* Apps section — collapsible */}
        {visibleAppNav.length > 0 && (
          <>
            {!isCollapsed ? (
              <button
                onClick={() => setExpandedSections((s) => ({ ...s, apps: !s.apps }))}
                className="w-full flex items-center justify-between px-3 pb-1 pt-4 group cursor-pointer"
              >
                <span className="text-[10px] uppercase tracking-wider text-semantic-text-subtle font-bold">
                  Apps
                </span>
                <ChevronDown
                  className={clsx(
                    'w-3 h-3 text-semantic-text-subtle transition-transform duration-150',
                    !expandedSections.apps && '-rotate-90'
                  )}
                />
              </button>
            ) : (
              <div className="my-2 border-t border-border" />
            )}
            {(isCollapsed || expandedSections.apps) && visibleAppNav.map(renderNavItem)}
          </>
        )}
      </nav>

      {/* Footer: collapse toggle + service status — single border-t, no internal borders */}
      <div className="shrink-0 border-t border-border">
        {/* Collapse toggle — no border on button */}
        <div className="px-2 py-2">
          <button
            onClick={toggleCollapsed}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={clsx(
              'w-full flex items-center gap-2.5 rounded-lg text-sm text-semantic-text-subtle transition-all duration-150',
              'hover:bg-interactive-hover',
              isCollapsed ? 'justify-center px-0 py-2' : 'px-3 py-2'
            )}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 shrink-0" />
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4 shrink-0" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>

        {/* Service status — bottom-justified, matches Lic sidebar footer */}
        {!isCollapsed ? (
          <div className="px-4 pb-3 pt-1">
            <div className="flex items-center gap-2 text-[11px] text-semantic-text-subtle">
              <span className={`w-2 h-2 rounded-full shrink-0 ${bridgeOnline ? 'bg-[#22c55e]' : 'bg-status-danger'}`} />
              <span>{bridgeOnline ? 'Bridge Online' : 'Bridge Offline'}</span>
            </div>
            {bridgeVersion && (
              <p className="text-[10px] text-semantic-text-subtle mt-1 ml-4">
                softbits-bridge v{bridgeVersion}
              </p>
            )}
          </div>
        ) : (
          <div className="flex justify-center pb-3">
            <span
              className={`w-2 h-2 rounded-full ${bridgeOnline ? 'bg-[#22c55e]' : 'bg-status-danger'}`}
              title={bridgeOnline ? 'Bridge Online' : 'Bridge Offline'}
            />
          </div>
        )}
        <p className="text-[10px] text-semantic-text-faint text-center pb-2">v{__APP_VERSION__}</p>
      </div>
    </aside>
  );
}
