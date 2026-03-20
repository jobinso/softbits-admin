import { useState } from 'react';
import { FolderTree, DollarSign, List, Warehouse } from 'lucide-react';
import { Tabs, PageHeader } from '@/components/shared';
import type { TabItem } from '@/components/shared';
import { ProjectTypesPage, CurrenciesPage, OptionSetsPage, WarehousesPage } from '@/pages/config';

const CONFIG_TABS: TabItem[] = [
  { id: 'project-types', label: 'Project Types', icon: <FolderTree className="w-4 h-4" /> },
  { id: 'currencies', label: 'Currencies', icon: <DollarSign className="w-4 h-4" /> },
  { id: 'option-sets', label: 'Option Sets', icon: <List className="w-4 h-4" /> },
  { id: 'warehouses', label: 'Warehouses', icon: <Warehouse className="w-4 h-4" /> },
];

export default function ConfigPage() {
  const [activeTab, setActiveTab] = useState('project-types');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuration"
        description="System settings and preferences"
      />

      <Tabs tabs={CONFIG_TABS} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'project-types' && <ProjectTypesPage />}
      {activeTab === 'currencies' && <CurrenciesPage />}
      {activeTab === 'option-sets' && <OptionSetsPage />}
      {activeTab === 'warehouses' && <WarehousesPage />}
    </div>
  );
}
