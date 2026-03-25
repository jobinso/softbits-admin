import { useState } from 'react';
import { DollarSign, List, Warehouse, Settings } from 'lucide-react';
import { Tabs, PageHeader } from '@/components/shared';
import type { TabItem } from '@/components/shared';
import { CurrenciesPage, OptionSetsPage, WarehousesPage, SystemSettingsPage } from '@/pages/config';

const CONFIG_TABS: TabItem[] = [
  { id: 'currencies', label: 'Currencies', icon: <DollarSign className="w-4 h-4" /> },
  { id: 'option-sets', label: 'Option Sets', icon: <List className="w-4 h-4" /> },
  { id: 'warehouses', label: 'Warehouses', icon: <Warehouse className="w-4 h-4" /> },
  { id: 'system-settings', label: 'System Settings', icon: <Settings className="w-4 h-4" /> },
];

export default function ConfigPage() {
  const [activeTab, setActiveTab] = useState('currencies');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuration"
        description="System settings and preferences"
      />

      <Tabs tabs={CONFIG_TABS} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'currencies' && <CurrenciesPage />}
      {activeTab === 'option-sets' && <OptionSetsPage />}
      {activeTab === 'warehouses' && <WarehousesPage />}
      {activeTab === 'system-settings' && <SystemSettingsPage />}
    </div>
  );
}
