import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeySquare, RotateCcw, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, EmptyState, LoadingSpinner } from '@/components/shared';
import {
  applyAccessPreset,
  getAccessCatalog,
  getRoleAccess,
  getRoles,
  updateRoleAccess,
} from '@/services/admin-service';
import type {
  AccessCatalogEntity,
  AccessEntry,
  AccessPreset,
  AccessAction,
} from '@/services/admin-service';
import type { ApiError } from '@/types';
import { ExposureMatrix } from './access/exposure-matrix';

const ALL_ACTIONS: AccessAction[] = ['get', 'browse', 'post', 'build'];

interface RoleOption {
  id: string;
  name: string;
}

function exposureKey(entity: string, action: AccessAction): string {
  return `${entity}::${action}`;
}

function entriesToMap(entries: AccessEntry[]): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const entry of entries) {
    map.set(exposureKey(entry.entity, entry.action), entry.isExposed);
  }
  return map;
}

function diffExposure(
  initial: Map<string, boolean>,
  current: Map<string, boolean>,
  catalog: AccessCatalogEntity[]
): Array<{ entity: string; action: AccessAction; isExposed: boolean }> {
  const changes: Array<{ entity: string; action: AccessAction; isExposed: boolean }> = [];
  for (const entity of catalog) {
    for (const action of entity.actions) {
      const key = exposureKey(entity.entity, action);
      const before = initial.get(key) === true;
      const after = current.get(key) === true;
      if (before !== after) {
        changes.push({ entity: entity.entity, action, isExposed: after });
      }
    }
  }
  return changes;
}

export default function AccessPage() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [exposure, setExposure] = useState<Map<string, boolean>>(new Map());
  const [initialExposure, setInitialExposure] = useState<Map<string, boolean>>(new Map());

  // ---- Data fetching ----

  const { data: rolesResponse, isLoading: rolesLoading } = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: getRoles,
  });

  const roles: RoleOption[] = useMemo(() => {
    const list = (rolesResponse?.roles ?? []) as Array<{ id: string; name: string }>;
    return list.map((r) => ({ id: r.id, name: r.name }));
  }, [rolesResponse]);

  // Pick initial role: ?roleId=X (from "Configure access" link in Roles tab),
  // otherwise default to admin (or first role).
  useEffect(() => {
    if (selectedRoleId || roles.length === 0) return;
    const params = new URLSearchParams(location.search);
    const requested = params.get('roleId');
    if (requested && roles.some((r) => r.id === requested)) {
      setSelectedRoleId(requested);
      return;
    }
    const adminRole = roles.find((r) => r.id === 'admin') ?? roles[0];
    setSelectedRoleId(adminRole.id);
  }, [roles, selectedRoleId, location.search]);

  const { data: catalog, isLoading: catalogLoading } = useQuery({
    queryKey: ['admin', 'access', 'catalog'],
    queryFn: getAccessCatalog,
  });

  const { data: exposureResponse, isLoading: exposureLoading } = useQuery({
    queryKey: ['admin', 'access', 'exposure', selectedRoleId],
    queryFn: () => getRoleAccess(selectedRoleId),
    enabled: !!selectedRoleId,
  });

  useEffect(() => {
    if (exposureResponse) {
      const map = entriesToMap(exposureResponse.entries ?? []);
      setExposure(new Map(map));
      setInitialExposure(new Map(map));
    }
  }, [exposureResponse]);

  // ---- Mutations ----

  const saveMutation = useMutation({
    mutationFn: (entries: Array<{ entity: string; action: AccessAction; isExposed: boolean }>) =>
      updateRoleAccess(selectedRoleId, entries),
    onSuccess: (data) => {
      toast.success(`Saved ${data.updated} change${data.updated === 1 ? '' : 's'}`);
      setInitialExposure(new Map(exposure));
      queryClient.invalidateQueries({
        queryKey: ['admin', 'access', 'exposure', selectedRoleId],
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'access', 'summary'] });
    },
    onError: (err: ApiError) => {
      toast.error(err.response?.data?.error || err.message || 'Failed to save access');
    },
  });

  const presetMutation = useMutation({
    mutationFn: (preset: AccessPreset) => applyAccessPreset(selectedRoleId, preset),
    onSuccess: (data) => {
      toast.success(`Preset applied (${data.updated} changes)`);
      queryClient.invalidateQueries({
        queryKey: ['admin', 'access', 'exposure', selectedRoleId],
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'access', 'summary'] });
    },
    onError: (err: ApiError) => {
      toast.error(err.response?.data?.error || err.message || 'Failed to apply preset');
    },
  });

  // ---- Derived state ----

  const isWildcard = selectedRoleId === 'admin';

  const dirtyChanges = useMemo(() => {
    if (!catalog?.entities) return [];
    return diffExposure(initialExposure, exposure, catalog.entities);
  }, [initialExposure, exposure, catalog]);

  const dirty = dirtyChanges.length > 0;

  const exposedCount = useMemo(() => {
    if (!catalog?.entities) return { exposed: 0, total: 0 };
    let exposed = 0;
    let total = 0;
    for (const entity of catalog.entities) {
      for (const action of entity.actions) {
        total += 1;
        if (isWildcard || exposure.get(exposureKey(entity.entity, action))) {
          exposed += 1;
        }
      }
    }
    return { exposed, total };
  }, [catalog, exposure, isWildcard]);

  // ---- Handlers ----

  function handleToggle(entity: string, action: AccessAction) {
    setExposure((prev) => {
      const next = new Map(prev);
      const key = exposureKey(entity, action);
      next.set(key, !next.get(key));
      return next;
    });
  }

  function handleToggleEntityRow(entity: string, value: boolean) {
    if (!catalog?.entities) return;
    const def = catalog.entities.find((e) => e.entity === entity);
    if (!def) return;
    setExposure((prev) => {
      const next = new Map(prev);
      for (const action of def.actions) {
        next.set(exposureKey(entity, action), value);
      }
      return next;
    });
  }

  function handleRevert() {
    setExposure(new Map(initialExposure));
  }

  function handleSave() {
    if (!dirty) return;
    saveMutation.mutate(dirtyChanges);
  }

  function handlePreset(preset: AccessPreset) {
    presetMutation.mutate(preset);
  }

  // ---- Render ----

  if (rolesLoading || catalogLoading) {
    return (
      <div className="flex items-center justify-center h-full py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (roles.length === 0) {
    return (
      <EmptyState
        icon={<KeySquare className="w-12 h-12" />}
        title="No roles defined"
        description="Create at least one role to configure access."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header / role selector / actions */}
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-semantic-text-faint uppercase tracking-wider mb-1">
              Role
            </label>
            <select
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              className="form-input w-56"
              disabled={saveMutation.isPending || presetMutation.isPending}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.id})
                </option>
              ))}
            </select>
          </div>
          {!isWildcard && (
            <div className="flex items-center gap-1">
              <PresetButton onClick={() => handlePreset('read-only')} loading={presetMutation.isPending}>
                Read-only
              </PresetButton>
              <PresetButton onClick={() => handlePreset('read-write')} loading={presetMutation.isPending}>
                Read-write
              </PresetButton>
              <PresetButton onClick={() => handlePreset('all')} loading={presetMutation.isPending}>
                All
              </PresetButton>
              <PresetButton onClick={() => handlePreset('none')} loading={presetMutation.isPending}>
                None
              </PresetButton>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleRevert}
            disabled={!dirty || saveMutation.isPending}
            icon={<RotateCcw className="w-4 h-4" />}
          >
            Revert
          </Button>
          <Button
            onClick={handleSave}
            loading={saveMutation.isPending}
            disabled={!dirty || isWildcard}
            icon={<Save className="w-4 h-4" />}
          >
            Save{dirty ? ` (${dirtyChanges.length})` : ''}
          </Button>
        </div>
      </div>

      {/* Status line */}
      <div className="flex items-center justify-between text-sm">
        <p className="text-semantic-text-faint">
          {isWildcard
            ? 'The admin role has wildcard access to every entity and action — not configurable.'
            : 'Grant the role access to entity x action combinations. Applies to both REST endpoints and Infuse MCP tools.'}
        </p>
        <p className="text-semantic-text-secondary tabular-nums">
          {exposedCount.exposed} of {exposedCount.total} cells exposed
        </p>
      </div>

      {/* Matrix */}
      {exposureLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="md" />
        </div>
      ) : (
        <ExposureMatrix
          catalog={catalog?.entities ?? []}
          exposure={exposure}
          isWildcard={isWildcard}
          onToggle={handleToggle}
          onToggleEntityRow={handleToggleEntityRow}
        />
      )}

      {/* Action legend */}
      <div className="text-xs text-semantic-text-faint flex flex-wrap gap-4">
        {ALL_ACTIONS.map((a) => (
          <span key={a}>
            <span className="font-medium text-semantic-text-secondary">{a}</span> —{' '}
            {actionDescription(a)}
          </span>
        ))}
      </div>
    </div>
  );
}

function PresetButton({
  onClick,
  loading,
  children,
}: {
  onClick: () => void;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="px-2.5 py-1.5 text-xs rounded border border-border text-semantic-text-secondary hover:bg-surface-overlay hover:text-semantic-text disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function actionDescription(action: AccessAction): string {
  switch (action) {
    case 'get':
      return 'read single record';
    case 'browse':
      return 'list / search';
    case 'post':
      return 'create record';
    case 'build':
      return 'update / mutate';
  }
}
