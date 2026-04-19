import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadingSpinner } from '@/components/shared';
import { getRoles } from '@/services/admin-service';
import { RoleTable } from './roles/role-table';
import { RoleFormModal } from './roles/role-form-modal';
import type { RoleRow } from './roles/role-table';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RolesPage() {
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null);

  // ---- Data fetching ----

  const { data: rolesResponse, isLoading } = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: getRoles,
  });

  const roles: RoleRow[] = rolesResponse?.roles ?? [];

  // ---- Handlers ----

  function handleCreate() {
    setEditingRole(null);
    setFormModalOpen(true);
  }

  function handleEdit(role: RoleRow) {
    setEditingRole(role);
    setFormModalOpen(true);
  }

  function handleCloseForm() {
    setFormModalOpen(false);
    setEditingRole(null);
  }

  // ---- Render ----

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <RoleTable
        roles={roles}
        onEdit={handleEdit}
        onCreate={handleCreate}
      />

      <RoleFormModal
        key={editingRole?.id || 'create'}
        isOpen={formModalOpen}
        onClose={handleCloseForm}
        role={editingRole}
      />
    </div>
  );
}
