export const ADMIN_TABS = {
  BRIDGE: [
    { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    { id: 'security', label: 'Security', icon: 'Shield' },
    { id: 'services', label: 'Services', icon: 'Server' },
    { id: 'cache', label: 'Cache', icon: 'Database' },
    { id: 'config', label: 'Config', icon: 'Settings' },
    { id: 'erp-config', label: 'ERP Config', icon: 'FileCode' },
    { id: 'licensing', label: 'Licensing', icon: 'Key' },
    { id: 'patches', label: 'Patches', icon: 'Package' },
    { id: 'providers', label: 'Providers', icon: 'Plug' },
  ],
  APPS: [
    { id: 'connectit', label: 'ConnectIT', icon: 'Users', app: 'connect' },
    { id: 'stackit', label: 'StackIT', icon: 'Warehouse', app: 'stack' },
    { id: 'flipit', label: 'FlipIT', icon: 'ShoppingCart', app: 'flip' },
    { id: 'floorit', label: 'FloorIT', icon: 'Factory', app: 'floor' },
    { id: 'labelit', label: 'LabelIT', icon: 'Tag', app: 'labels' },
    { id: 'shopit', label: 'ShopIT', icon: 'Store', app: 'shop' },
    { id: 'infuseit', label: 'InfuseIT', icon: 'Brain', app: 'infuse' },
    { id: 'workit', label: 'WorkIT', icon: 'Briefcase', app: 'work' },
    { id: 'pulpit', label: 'PulpIT', icon: 'FileText', app: 'pulp' },
  ],
} as const;

export const STORAGE_KEYS = {
  AUTH: 'admin-auth',
  SIDEBAR_COLLAPSED: 'softbits_admin_sidebar_collapsed',
} as const;
