import { useState } from 'react';
import { Users, ShieldCheck, KeyRound, Shield, KeySquare } from 'lucide-react';
import { Tabs, PageHeader } from '@/components/shared';
import type { TabItem } from '@/components/shared';
import { UsersPage, RolesPage, TokensPage, AccessPage } from './security';

const tabs: TabItem[] = [
  { id: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
  { id: 'roles', label: 'Roles', icon: <ShieldCheck className="w-4 h-4" /> },
  { id: 'tokens', label: 'Tokens', icon: <KeyRound className="w-4 h-4" /> },
  { id: 'access', label: 'Access', icon: <KeySquare className="w-4 h-4" /> },
];

export default function SecurityPage() {
  const [activeTab, setActiveTab] = useState('users');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security"
        description="Manage users, roles, tokens, and per-role entity x action access (governs both REST endpoints and Infuse MCP tools)"
        icon={<Shield className="w-5 h-5" />}
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'users' && <UsersPage />}
      {activeTab === 'roles' && <RolesPage />}
      {activeTab === 'tokens' && <TokensPage />}
      {activeTab === 'access' && <AccessPage />}
    </div>
  );
}
