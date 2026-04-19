import { Construction } from 'lucide-react';

export function createPlaceholderPage(title: string) {
  return function PlaceholderPage() {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-2">
          <Construction className="w-5 h-5 text-dark-400" />
          <h1 className="text-xl font-semibold text-dark-700">{title}</h1>
        </div>
        <p className="text-dark-400 mt-2">This page is under construction.</p>
      </div>
    );
  };
}
