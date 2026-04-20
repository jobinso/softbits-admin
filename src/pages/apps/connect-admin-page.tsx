import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  RefreshCw,
  Play,
  Users,
  GitBranch,
  CreditCard,
  Briefcase,
  MapPin,
} from 'lucide-react';
import {
  StatusBadge,
  LoadingSpinner,
  Tabs,
  PageHeader,
  PageStatusBar,
} from '@/components/shared';
import type { TabItem, StatusBarItem } from '@/components/shared';
import { getConnectSyncStatus } from '@/services/admin-service';
import type { ConnectSyncStatus } from '@/types';
import { ConnectStatusTab } from './connect/connect-status-tab';
import { ConnectSyncTab } from './connect/connect-sync-tab';
import { ConnectTeamsTab } from './connect/connect-teams-tab';
import { ConnectSalesCyclesTab } from './connect/connect-sales-cycles-tab';
import { ConnectRateCardsTab } from './connect/connect-rate-cards-tab';
import { ConnectBillingRolesTab } from './connect/connect-billing-roles-tab';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONNECT_TABS: TabItem[] = [
  { id: 'status', label: 'Status', icon: <RefreshCw className="w-4 h-4" /> },
  { id: 'sync', label: 'Sync', icon: <Play className="w-4 h-4" /> },
  { id: 'teams', label: 'Teams', icon: <Users className="w-4 h-4" /> },
  { id: 'salescycles', label: 'Sales Cycles', icon: <GitBranch className="w-4 h-4" /> },
  { id: 'rates', label: 'Rate Cards', icon: <CreditCard className="w-4 h-4" /> },
  { id: 'roles', label: 'Billing Roles', icon: <Briefcase className="w-4 h-4" /> },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeAgo(dateInput?: string | null): string {
  if (!dateInput) return 'Never';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'Never';
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ConnectAdminPage() {
  const [activeTab, setActiveTab] = useState('status');

  const { data: syncStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['connect', 'sync-status'],
    queryFn: getConnectSyncStatus,
    refetchInterval: 10000,
    enabled: activeTab === 'status' || activeTab === 'sync',
  });

  if (statusLoading && activeTab === 'status') {
    return <div className="flex items-center justify-center h-full"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="ConnectIT Admin"
        description="Manage CRM sync, teams, sales cycles, rate cards, and billing roles"
        icon={<MapPin className="w-5 h-5" />}
      />

      <PageStatusBar
        items={[
          { type: 'badge', label: 'Service', status: syncStatus ? 'success' : 'danger', badgeLabel: syncStatus ? 'Connected' : 'Offline' },
          { type: 'badge', label: 'Sync', status: syncStatus?.isRunning ? 'warning' : 'success', badgeLabel: syncStatus?.isRunning ? 'Syncing...' : 'Ready' },
          { type: 'text', label: 'Last Sync', value: formatTimeAgo(syncStatus?.lastSync) },
          {
            type: 'text',
            label: 'Pending',
            value: syncStatus?.queuePending ?? 0,
            colorClass: 'text-warning',
            visible: (syncStatus?.queuePending ?? 0) > 0,
          },
        ] as StatusBarItem[]}
      />

      <Tabs tabs={CONNECT_TABS} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'status' && <ConnectStatusTab />}
      {activeTab === 'sync' && <ConnectSyncTab />}
      {activeTab === 'teams' && <ConnectTeamsTab />}
      {activeTab === 'salescycles' && <ConnectSalesCyclesTab />}
      {activeTab === 'rates' && <ConnectRateCardsTab />}
      {activeTab === 'roles' && <ConnectBillingRolesTab />}
    </div>
  );
}
