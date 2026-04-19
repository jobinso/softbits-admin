import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadingSpinner } from '@/components/shared';
import { getUsers, getRoles } from '@/services/admin-service';
import { UserTable } from './users/user-table';
import { UserFormModal } from './users/user-form-modal';
import type { UserRow } from './users/user-table';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function UsersPage() {
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);

  // ---- Data fetching ----

  const { data: usersResponse, isLoading: usersLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: getUsers,
  });

  const { data: rolesResponse } = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: getRoles,
  });

  const users: UserRow[] = usersResponse?.users ?? [];
  const roles = rolesResponse?.roles ?? [];

  // ---- Handlers ----

  function handleCreate() {
    setEditingUser(null);
    setFormModalOpen(true);
  }

  function handleEdit(user: UserRow) {
    setEditingUser(user);
    setFormModalOpen(true);
  }

  function handleCloseForm() {
    setFormModalOpen(false);
    setEditingUser(null);
  }

  // ---- Render ----

  if (usersLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <UserTable
        users={users}
        roles={roles}
        onEdit={handleEdit}
        onCreate={handleCreate}
      />

      <UserFormModal
        key={editingUser?.id || 'create'}
        isOpen={formModalOpen}
        onClose={handleCloseForm}
        user={editingUser}
        roles={roles}
      />
    </div>
  );
}
