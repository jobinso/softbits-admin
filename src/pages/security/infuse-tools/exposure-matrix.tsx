import { useMemo } from 'react';
import type { InfuseCatalogEntity, InfuseToolAction } from '@/services/admin-service';

const ALL_ACTIONS: InfuseToolAction[] = ['get', 'browse', 'post', 'build'];

interface ExposureMatrixProps {
  catalog: InfuseCatalogEntity[];
  exposure: Map<string, boolean>;
  isWildcard: boolean;
  onToggle: (entity: string, action: InfuseToolAction) => void;
  onToggleEntityRow: (entity: string, value: boolean) => void;
}

export function ExposureMatrix({
  catalog,
  exposure,
  isWildcard,
  onToggle,
  onToggleEntityRow,
}: ExposureMatrixProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, InfuseCatalogEntity[]>();
    for (const entity of catalog) {
      const group = entity.group || 'Other';
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(entity);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [catalog]);

  if (catalog.length === 0) {
    return (
      <div className="border border-border rounded-lg p-8 text-center text-semantic-text-faint text-sm">
        No tool catalog entries available. Register endpoints with <code>@endpoint</code> annotations
        to populate this matrix.
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-overlay">
            <th className="text-left px-3 py-2 text-xs font-medium text-semantic-text-faint uppercase tracking-wider">
              Entity
            </th>
            {ALL_ACTIONS.map((action) => (
              <th
                key={action}
                className="text-center px-2 py-2 text-xs font-medium text-semantic-text-faint uppercase tracking-wider w-20"
              >
                {action}
              </th>
            ))}
            <th className="text-center px-2 py-2 text-xs font-medium text-semantic-text-faint uppercase tracking-wider w-16">
              Row
            </th>
          </tr>
        </thead>
        <tbody>
          {grouped.map(([group, entities]) => (
            <GroupRows
              key={group}
              group={group}
              entities={entities}
              exposure={exposure}
              isWildcard={isWildcard}
              onToggle={onToggle}
              onToggleEntityRow={onToggleEntityRow}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupRows({
  group,
  entities,
  exposure,
  isWildcard,
  onToggle,
  onToggleEntityRow,
}: {
  group: string;
  entities: InfuseCatalogEntity[];
  exposure: Map<string, boolean>;
  isWildcard: boolean;
  onToggle: (entity: string, action: InfuseToolAction) => void;
  onToggleEntityRow: (entity: string, value: boolean) => void;
}) {
  return (
    <>
      <tr className="bg-surface-subtle">
        <td
          colSpan={ALL_ACTIONS.length + 2}
          className="px-3 py-1 text-xs font-medium text-semantic-text-secondary uppercase tracking-wider"
        >
          {group}
        </td>
      </tr>
      {entities.map((entity, idx) => {
        const supported = new Set(entity.actions);
        const rowAllOn = ALL_ACTIONS.every(
          (a) => !supported.has(a) || isExposed(exposure, entity.entity, a, isWildcard)
        );

        return (
          <tr
            key={entity.entity}
            className={idx % 2 === 0 ? 'bg-surface-raised' : 'bg-surface-raised/50'}
          >
            <td className="px-3 py-2 text-semantic-text-secondary">
              <div className="flex items-center gap-2">
                <span>{entity.entity}</span>
                {entity.isDangerous && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/30"
                    title="Marked as dangerous in api_Endpoints"
                  >
                    !
                  </span>
                )}
              </div>
            </td>
            {ALL_ACTIONS.map((action) => {
              const isSupported = supported.has(action);
              if (!isSupported) {
                return (
                  <td
                    key={action}
                    className="text-center px-2 py-2 text-semantic-text-faint"
                  >
                    —
                  </td>
                );
              }
              return (
                <td key={action} className="text-center px-2 py-2">
                  <input
                    type="checkbox"
                    disabled={isWildcard}
                    checked={isExposed(exposure, entity.entity, action, isWildcard)}
                    onChange={() => onToggle(entity.entity, action)}
                    className="rounded border-border bg-surface-subtle text-primary focus:ring-interactive-focus-ring cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </td>
              );
            })}
            <td className="text-center px-2 py-2">
              <input
                type="checkbox"
                disabled={isWildcard}
                checked={rowAllOn}
                onChange={(e) => onToggleEntityRow(entity.entity, e.target.checked)}
                className="rounded border-border bg-surface-subtle text-primary focus:ring-interactive-focus-ring cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                title="Toggle all supported actions for this entity"
              />
            </td>
          </tr>
        );
      })}
    </>
  );
}

function isExposed(
  exposure: Map<string, boolean>,
  entity: string,
  action: InfuseToolAction,
  isWildcard: boolean
): boolean {
  if (isWildcard) return true;
  return exposure.get(`${entity}::${action}`) === true;
}
