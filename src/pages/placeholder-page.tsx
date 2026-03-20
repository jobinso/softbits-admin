import { Construction } from 'lucide-react';
import { PageHeader } from '@/components/shared';

export function createPlaceholderPage(title: string) {
  return function PlaceholderPage() {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Coming Soon"
          description="This feature is under development"
        />
        <div className="flex items-center gap-3 text-semantic-text-faint py-12 justify-center">
          <Construction className="w-8 h-8" />
          <p className="text-lg">{title} is under construction.</p>
        </div>
      </div>
    );
  };
}
