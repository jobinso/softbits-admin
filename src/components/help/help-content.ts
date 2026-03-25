/**
 * Help Content
 * Topic definitions and built-in help content for AdminIT
 */

export const helpTopics: Record<string, { title: string; file: string }> = {
  'admin-overview': { title: 'Getting Started', file: 'admin-overview' },
  'admin-dashboard': { title: 'Dashboard', file: 'admin-dashboard' },
  'admin-users': { title: 'User Management', file: 'admin-users' },
  'admin-roles': { title: 'Role Management', file: 'admin-roles' },
  'admin-devices': { title: 'Device Management', file: 'admin-devices' },
  'admin-tokens': { title: 'API Tokens', file: 'admin-tokens' },
  'admin-licensing': { title: 'Licensing', file: 'admin-licensing' },
  'admin-services': { title: 'Service Monitoring', file: 'admin-services' },
  'admin-cache': { title: 'Cache Management', file: 'admin-cache' },
  'admin-erp-config': { title: 'ERP Configuration', file: 'admin-erp-config' },
  'admin-system-settings': { title: 'System Settings', file: 'admin-system-settings' },
  'admin-currencies': { title: 'Currencies', file: 'admin-currencies' },
  'admin-warehouses': { title: 'Warehouses', file: 'admin-warehouses' },
  'admin-project-types': { title: 'Project Types', file: 'admin-project-types' },
  'admin-option-sets': { title: 'Option Sets', file: 'admin-option-sets' },
  'admin-security': { title: 'Security & Providers', file: 'admin-security' },
  'admin-apps': { title: 'App Administration', file: 'admin-apps' },
  'admin-patches': { title: 'Database Patches', file: 'admin-patches' },
  'admin-shortcuts': { title: 'Keyboard Shortcuts', file: 'admin-shortcuts' },
};

/** Map route paths to help topic IDs for contextual help */
export const routeToTopic: Record<string, string> = {
  '/': 'admin-dashboard',
  '/security': 'admin-security',
  '/security/users': 'admin-users',
  '/security/roles': 'admin-roles',
  '/security/devices': 'admin-devices',
  '/security/tokens': 'admin-tokens',
  '/security/endpoints': 'admin-security',
  '/security/providers': 'admin-security',
  '/services': 'admin-services',
  '/cache': 'admin-cache',
  '/config': 'admin-system-settings',
  '/config/system-settings': 'admin-system-settings',
  '/config/currencies': 'admin-currencies',
  '/config/warehouses': 'admin-warehouses',
  '/config/project-types': 'admin-project-types',
  '/config/option-sets': 'admin-option-sets',
  '/erp-config': 'admin-erp-config',
  '/licensing': 'admin-licensing',
  '/patches': 'admin-patches',
  '/providers': 'admin-security',
};

// Markdown to HTML converter — local ESM version (softbits-shared uses CJS which Vite can't transform via alias)
export { markdownToHtml } from '@/utils/markdown';

// Built-in help content (fallback when API is unavailable)
export const builtInHelpContent: Record<string, { title: string; content: string }> = {
  'admin-overview': {
    title: 'Getting Started with AdminIT',
    content: `# Getting Started with AdminIT

## Welcome to softBITS AdminIT

AdminIT is the system administration console for the softBITS platform. It provides centralized management of users, devices, services, licensing, and configuration across all softBITS applications.

### Main Features

- **Dashboard** - Real-time system health overview and quick stats
- **Security** - Users, Roles, Devices, Tokens, Endpoints, Providers
- **Services** - Service health monitoring, logs, tasks, and environment
- **Cache** - Cache performance stats, warmer control, and TTL configuration
- **Config** - System settings, currencies, warehouses, option sets
- **Licensing** - Subscription details, modules, compliance
- **Apps** - Per-application admin pages

### Navigation

Use the sidebar on the left to navigate between sections. The sidebar is organized into Bridge and Apps sections.

### Quick Actions

- **Ctrl+K** - Open the command palette to quickly navigate anywhere
- **?** or **F1** - Open this help system
- **Esc** - Close modals and dialogs

### Need More Help?

Select a topic from the sidebar to learn about specific AdminIT features.`,
  },
  'admin-dashboard': {
    title: 'Dashboard',
    content: `# Dashboard

## System Health Overview

The Dashboard provides a real-time view of the softBITS platform health and key statistics.

### Service Status Grid

- **ERP** - SYSPRO connection status
- **Database** - SQL Server connection health
- **Cache** - Cache layer status and hit rate

### Quick Stats

- **Users** - Total registered user accounts
- **Devices** - Total registered devices
- **Tokens** - Total API tokens
- **Cache Entries** - Current cached key count

### App Service Table

Lists all registered softBITS applications with their enabled/connected state and uptime.`,
  },
  'admin-shortcuts': {
    title: 'Keyboard Shortcuts',
    content: `# Keyboard Shortcuts

## Global

- **Ctrl+K** - Open the command palette
- **?** or **F1** - Open the help system
- **Esc** - Close modals, dialogs, and the command palette

## Navigation

- Use the sidebar to navigate between sections
- Use the command palette for quick navigation

## Tables

- Click column headers to sort
- Use the search bar to filter rows

## Help

- **?** - Open help (when not in a text input)
- **F1** - Open help (always works)
- **Esc** - Close the help modal`,
  },
};
