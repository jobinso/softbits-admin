import type { LucideIcon } from 'lucide-react';
import { StatusBadge } from '@/components/shared';
import type { StatusBadgeProps } from '@/components/shared';

interface StatusItem {
  label: string;
  value: string | React.ReactNode;
}

export interface StatusCardProps {
  title: string;
  icon: LucideIcon;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  items: StatusItem[];
}

const statusToBadge: Record<StatusCardProps['status'], { status: StatusBadgeProps['status']; label: string }> = {
  healthy: { status: 'success', label: 'Healthy' },
  degraded: { status: 'warning', label: 'Degraded' },
  down: { status: 'danger', label: 'Down' },
  unknown: { status: 'neutral', label: 'Unknown' },
};

export function StatusCard({ title, icon: Icon, status, items }: StatusCardProps) {
  const badge = statusToBadge[status];

  return (
    <div className="bg-dark-50 border border-dark-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-dark-500" />
          <h3 className="text-sm font-semibold text-dark-700">{title}</h3>
        </div>
        <StatusBadge status={badge.status} label={badge.label} size="sm" />
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between text-sm">
            <span className="text-dark-400">{item.label}</span>
            <span className="text-dark-600 font-medium">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
