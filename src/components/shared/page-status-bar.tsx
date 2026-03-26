import { StatusBadge } from '@shared/components';

type BadgeStatus = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface StatusBarBadgeItem {
  type: 'badge';
  label: string;
  status: BadgeStatus;
  badgeLabel: string;
  visible?: boolean;
}

export interface StatusBarTextItem {
  type: 'text';
  label: string;
  value: string | number;
  colorClass?: string;
  visible?: boolean;
}

export type StatusBarItem = StatusBarBadgeItem | StatusBarTextItem;

export interface PageStatusBarProps {
  items: StatusBarItem[];
  className?: string;
}

export function PageStatusBar({ items, className }: PageStatusBarProps) {
  const visibleItems = items.filter((item) => item.visible !== false);

  return (
    <div className={`flex flex-wrap items-center gap-6 p-4 bg-surface-raised border border-border rounded-xl text-xs${className ? ` ${className}` : ''}`}>
      {visibleItems.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="text-semantic-text-faint">{item.label}:</span>
          {item.type === 'badge' ? (
            <StatusBadge status={item.status} label={item.badgeLabel} size="sm" />
          ) : (
            <span className={`${item.colorClass || 'text-semantic-text-secondary'} font-medium${typeof item.value === 'number' ? ' tabular-nums' : ''}`}>
              {item.value}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
