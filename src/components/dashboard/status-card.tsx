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
    <div className="bg-surface-raised border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-semantic-text-subtle" />
          <h3 className="text-sm font-semibold text-semantic-text-default">{title}</h3>
        </div>
        <StatusBadge status={badge.status} label={badge.label} size="sm" />
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between text-sm">
            <span className="text-semantic-text-subtle">{item.label}</span>
            <span className="text-semantic-text-secondary font-medium">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
