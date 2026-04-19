import { Monitor } from 'lucide-react';
import { StatusBadge } from '@/components/shared';
import type { AppStatus } from '@/types';

export interface AppStatusGridProps {
  apps: Record<string, AppStatus>;
}

export function AppStatusGrid({ apps }: AppStatusGridProps) {
  const enabledApps = Object.entries(apps).filter(([, app]) => app.enabled);

  if (enabledApps.length === 0) {
    return (
      <p className="text-sm text-dark-400">No apps are currently enabled.</p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {enabledApps.map(([key, app]) => (
        <div
          key={key}
          className="bg-dark-50 border border-dark-200 rounded-xl p-4 flex items-center gap-3"
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-dark-100">
            <Monitor className="w-4 h-4 text-dark-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-dark-700 truncate">
                {app.name || key}
              </span>
              <StatusBadge
                status={app.healthy ? 'success' : 'danger'}
                label={app.healthy ? 'Healthy' : 'Unhealthy'}
                size="sm"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
