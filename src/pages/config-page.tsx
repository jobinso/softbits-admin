import { useState } from 'react';
import { DollarSign, ArrowLeftRight, Sliders, ListTree } from 'lucide-react';
import { Tabs, PageHeader } from '@/components/shared';
import type { TabItem } from '@/components/shared';
import { CurrenciesPage, ExchangeRatesPage, ConfigurationPage, OptionsPage } from '@/pages/config';

const CONFIG_TABS: TabItem[] = [
  { id: 'currencies', label: 'Currencies', icon: <DollarSign className="w-4 h-4" /> },
  { id: 'exchange-rates', label: 'Exchange Rates', icon: <ArrowLeftRight className="w-4 h-4" /> },
  { id: 'configuration', label: 'Configuration', icon: <Sliders className="w-4 h-4" /> },
  { id: 'options', label: 'Options', icon: <ListTree className="w-4 h-4" /> },
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
      {activeTab === 'exchange-rates' && <ExchangeRatesPage />}
      {activeTab === 'configuration' && <ConfigurationPage />}
      {activeTab === 'options' && <OptionsPage />}
    </div>
  );
}
