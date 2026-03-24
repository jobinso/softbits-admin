import { useState } from 'react';
import { Search, Hammer, ArrowLeftRight, Flame } from 'lucide-react';
import { Tabs, PageHeader } from '@/components/shared';
import type { TabItem } from '@/components/shared';
import { ErpConfigFileManager } from '@/pages/erp-config';

const ERP_CONFIG_TABS: TabItem[] = [
  { id: 'query', label: 'Query', icon: <Search className="w-4 h-4" /> },
  { id: 'build', label: 'Build', icon: <Hammer className="w-4 h-4" /> },
  { id: 'fieldmap', label: 'FieldMap', icon: <ArrowLeftRight className="w-4 h-4" /> },
  { id: 'warmer', label: 'Warmer', icon: <Flame className="w-4 h-4" /> },
];

export default function ErpConfigPage() {
  const [activeTab, setActiveTab] = useState('query');

  return (
    <div className="space-y-6">
      <PageHeader
        title="ERP Config Files"
        description="Browse and edit SYSPRO business object configuration files"
      />

      <Tabs tabs={ERP_CONFIG_TABS} activeTab={activeTab} onChange={setActiveTab} />

      <ErpConfigFileManager folder={activeTab} />
    </div>
  );
}
