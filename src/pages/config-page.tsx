import { useState } from 'react';
import { DollarSign, Sliders } from 'lucide-react';
import { Tabs, PageHeader } from '@/components/shared';
import type { TabItem } from '@/components/shared';
import { CurrenciesPage, ConfigurationPage } from '@/pages/config';

const CONFIG_TABS: TabItem[] = [
  { id: 'currencies', label: 'Currencies', icon: <DollarSign className="w-4 h-4" /> },
  { id: 'configuration', label: 'Configuration', icon: <Sliders className="w-4 h-4" /> },
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
      {activeTab === 'configuration' && <ConfigurationPage />}
    </div>
  );
}
