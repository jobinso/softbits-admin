import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderKanban, Plus, Edit, Trash2, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DataTable,
  Button,
  Modal,
  StatusBadge,
  LoadingSpinner,
  Tabs,
  PageHeader,
} from '@/components/shared';
import type { ColumnDef, TabItem } from '@/components/shared';
import {
  getProjectTypes,
  createProjectType,
  updateProjectType,
  deleteProjectType,
  getProjectTypeStatuses,
  createProjectTypeStatus,
  updateProjectTypeStatus,
  deleteProjectTypeStatus as deleteStatusApi,
  getProjectTypeFields,
  updateProjectTypeField,
} from '@/services/admin-service';
import { useModal } from '@shared/hooks';
import type { ProjectType, ProjectTypeStatus, ProjectTypeField } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TASK_TYPES = ['task', 'milestone', 'deliverable', 'deliverable-parent', 'phase'] as const;
const TASK_TYPE_LABELS: Record<string, string> = {
  task: 'Tasks',
  milestone: 'Milestones',
  deliverable: 'Deliverables',
  'deliverable-parent': 'Del. Parent',
  phase: 'Phases',
};

const FIELD_LABELS: Record<string, string> = {
  StartDate: 'Start Date',
  EndDate: 'End Date',
  TargetDate: 'Target Date',
  EstimatedHours: 'Est. Hours',
  Progress: 'Progress',
  AssigneeIds: 'Assignees',
  IsBillable: 'Billable',
  RoleId: 'Role',
  AcceptanceStatus: 'Acceptance Status',
  AcceptanceCriteria: 'Acceptance Criteria',
  GateApproval: 'Gate Approval',
};

// ---------------------------------------------------------------------------
// Form types
// ---------------------------------------------------------------------------

interface ProjectTypeForm {
  name: string;
  description: string;
  isDefault: boolean;
}

interface StatusForm {
  displayLabel: string;
  statusValue: string;
  badgeColor: string;
  sortOrder: number;
  isDefault: boolean;
  isFinal: boolean;
}

const INITIAL_TYPE_FORM: ProjectTypeForm = { name: '', description: '', isDefault: false };
const INITIAL_STATUS_FORM: StatusForm = { displayLabel: '', statusValue: '', badgeColor: '#64748b', sortOrder: 0, isDefault: false, isFinal: false };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProjectTypesPage() {
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<ProjectType | null>(null);
  const [selectedTaskType, setSelectedTaskType] = useState<string>('task');
  const typeModal = useModal<ProjectType>();
  const deleteModal = useModal<ProjectType>();
  const statusModal = useModal<ProjectTypeStatus>();
  const deleteStatusModal = useModal<ProjectTypeStatus>();
  const [typeForm, setTypeForm] = useState<ProjectTypeForm>(INITIAL_TYPE_FORM);
  const [statusForm, setStatusForm] = useState<StatusForm>(INITIAL_STATUS_FORM);
  const [isEditingType, setIsEditingType] = useState(false);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);

  // ---- Data fetching ----

  const { data: typesResponse, isLoading } = useQuery({
    queryKey: ['admin', 'project-types'],
    queryFn: getProjectTypes,
  });

  const projectTypes: ProjectType[] = typesResponse?.data ?? [];

  const { data: statusesResponse, isLoading: statusesLoading } = useQuery({
    queryKey: ['admin', 'project-type-statuses', selectedType?.Id, selectedTaskType],
    queryFn: () => getProjectTypeStatuses(selectedType!.Id, selectedTaskType),
    enabled: !!selectedType,
  });

  const statuses: ProjectTypeStatus[] = statusesResponse?.data ?? [];

  const { data: fieldsResponse } = useQuery({
    queryKey: ['admin', 'project-type-fields', selectedType?.Id, selectedTaskType],
    queryFn: () => getProjectTypeFields(selectedType!.Id, selectedTaskType),
    enabled: !!selectedType,
  });

  const fields: ProjectTypeField[] = fieldsResponse?.data ?? [];
  const displayFields = fields.length > 0 ? fields : Object.keys(FIELD_LABELS).map((name) => ({
    FieldName: name,
    Visibility: 'visible' as const,
    IsRequired: false,
  }));

  // ---- Mutations ----

  const createTypeMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; isDefault?: boolean }) => createProjectType(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'project-types'] });
      typeModal.close();
      toast.success('Project type created');
      const newId = result.data?.Id || result.data?.id;
      if (newId) {
        const newType = { Id: newId, Name: typeForm.name, Description: typeForm.description, IsDefault: typeForm.isDefault, IsActive: true };
        setSelectedType(newType as ProjectType);
      }
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create project type'),
  });

  const updateTypeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string; isDefault?: boolean } }) => updateProjectType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'project-types'] });
      typeModal.close();
      toast.success('Project type updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update project type'),
  });

  const deleteTypeMutation = useMutation({
    mutationFn: (id: string) => deleteProjectType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'project-types'] });
      deleteModal.close();
      setSelectedType(null);
      toast.success('Project type deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete project type'),
  });

  const createStatusMutation = useMutation({
    mutationFn: (data: Partial<ProjectTypeStatus>) => createProjectTypeStatus(selectedType!.Id, selectedTaskType, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'project-type-statuses'] });
      statusModal.close();
      toast.success('Status created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create status'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ statusId, data }: { statusId: string; data: Partial<ProjectTypeStatus> }) => updateProjectTypeStatus(selectedType!.Id, statusId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'project-type-statuses'] });
      statusModal.close();
      toast.success('Status updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update status'),
  });

  const deleteStatusMutation = useMutation({
    mutationFn: (statusId: string) => deleteStatusApi(selectedType!.Id, statusId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'project-type-statuses'] });
      deleteStatusModal.close();
      toast.success('Status deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete status'),
  });

  const updateFieldMutation = useMutation({
    mutationFn: (data: { taskType: string; fieldName: string; visibility?: string; isRequired?: boolean }) =>
      updateProjectTypeField(selectedType!.Id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'project-type-fields'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update field'),
  });

  // ---- Handlers ----

  function openCreateType() {
    setTypeForm(INITIAL_TYPE_FORM);
    setIsEditingType(false);
    typeModal.open();
  }

  function openEditType(type: ProjectType) {
    setTypeForm({ name: type.Name, description: type.Description || '', isDefault: type.IsDefault });
    setIsEditingType(true);
    typeModal.open(type);
  }

  function handleSaveType() {
    if (!typeForm.name.trim()) { toast.error('Name is required'); return; }
    if (isEditingType && typeModal.data) {
      updateTypeMutation.mutate({ id: typeModal.data.Id, data: typeForm });
    } else {
      createTypeMutation.mutate(typeForm);
    }
  }

  function openCreateStatus() {
    setStatusForm(INITIAL_STATUS_FORM);
    setIsEditingStatus(false);
    setEditingStatusId(null);
    statusModal.open();
  }

  function openEditStatus(status: ProjectTypeStatus) {
    const id = status.StatusId || status.Id || '';
    setStatusForm({
      displayLabel: status.DisplayLabel || '',
      statusValue: status.StatusValue || '',
      badgeColor: status.BadgeColor || status.Colour || '#64748b',
      sortOrder: status.SortOrder ?? 0,
      isDefault: status.IsDefault,
      isFinal: status.IsFinal || status.IsTerminal || false,
    });
    setIsEditingStatus(true);
    setEditingStatusId(id);
    statusModal.open(status);
  }

  function handleSaveStatus() {
    if (!statusForm.displayLabel.trim()) { toast.error('Label is required'); return; }
    if (!isEditingStatus && !statusForm.statusValue.trim()) { toast.error('Status key is required'); return; }
    if (isEditingStatus && editingStatusId) {
      updateStatusMutation.mutate({ statusId: editingStatusId, data: statusForm });
    } else {
      createStatusMutation.mutate(statusForm);
    }
  }

  function autoGenerateKey(label: string) {
    if (isEditingStatus) return;
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    setStatusForm((f) => ({ ...f, statusValue: key }));
  }

  // ---- Task type tabs ----

  const taskTypeTabs: TabItem[] = TASK_TYPES.map((t) => ({
    id: t,
    label: TASK_TYPE_LABELS[t],
  }));

  // ---- Column definitions ----

  const statusColumns: ColumnDef<ProjectTypeStatus>[] = [
    {
      key: 'DisplayLabel',
      label: 'Label',
      sortable: true,
      render: (val) => <span className="font-medium text-dark-700">{val}</span>,
    },
    {
      key: 'StatusValue',
      label: 'Key',
      width: 150,
      sortable: true,
      render: (val) => <code className="text-xs bg-info/10 text-info px-1.5 py-0.5 rounded">{val}</code>,
    },
    {
      key: 'BadgeColor',
      label: 'Color',
      width: 80,
      sortable: false,
      render: (val, row) => {
        const color = val || row.Colour || '#6b7280';
        return <span className="inline-block w-4 h-4 rounded-full" style={{ backgroundColor: color }} />;
      },
    },
    {
      key: 'IsDefault',
      label: 'Default',
      width: 80,
      sortable: true,
      render: (val) => val ? <StatusBadge status="info" label="Yes" size="sm" /> : <span className="text-dark-400">-</span>,
    },
    {
      key: 'IsFinal',
      label: 'Terminal',
      width: 80,
      sortable: true,
      render: (val, row) => (val || row.IsTerminal) ? <StatusBadge status="warning" label="Yes" size="sm" /> : <span className="text-dark-400">-</span>,
    },
    {
      key: 'StatusId',
      label: 'Actions',
      width: 120,
      sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openEditStatus(row)} className="p-1.5 text-dark-400 hover:text-primary rounded hover:bg-dark-100 transition-colors" title="Edit">
            <Edit className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => deleteStatusModal.open(row)} className="p-1.5 text-dark-400 hover:text-danger rounded hover:bg-dark-100 transition-colors" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  // ---- Render ----

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Project Types"
        description={`${projectTypes.length} total — configure statuses, fields, and task types`}
        icon={<FolderKanban className="w-5 h-5" />}
        actions={
          <Button icon={<Plus className="w-4 h-4" />} onClick={openCreateType}>
            Add Type
          </Button>
        }
      />

      {/* Main content: two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Types list */}
        <div className="lg:col-span-1">
          <div className="rounded-lg border border-dark-200 bg-dark-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-dark-200">
              <h2 className="text-sm font-medium text-dark-600">Types</h2>
            </div>
            <div className="divide-y divide-dark-200 max-h-[600px] overflow-y-auto">
              {projectTypes.length === 0 ? (
                <div className="p-6 text-center text-dark-400 text-sm">No project types. Click "Add Type" to create one.</div>
              ) : (
                projectTypes.map((t) => (
                  <button
                    key={t.Id}
                    type="button"
                    onClick={() => { setSelectedType(t); setSelectedTaskType('task'); }}
                    className={`w-full px-4 py-3 text-left flex items-center justify-between transition-colors ${
                      selectedType?.Id === t.Id ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-dark-100'
                    }`}
                  >
                    <div>
                      <div className={`text-sm font-medium ${selectedType?.Id === t.Id ? 'text-primary' : 'text-dark-600'}`}>
                        {t.Name}
                      </div>
                      {t.IsDefault && <span className="text-xs text-primary">(Default)</span>}
                    </div>
                    <ChevronRight className="w-4 h-4 text-dark-400" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Detail panel */}
        <div className="lg:col-span-2">
          {!selectedType ? (
            <div className="rounded-lg border border-dark-200 bg-dark-50 p-12 text-center">
              <FolderKanban className="w-12 h-12 text-dark-300 mx-auto mb-3" />
              <p className="text-dark-400">Select a project type to configure its statuses and fields.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Type header */}
              <div className="rounded-lg border border-dark-200 bg-dark-50 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-semibold text-dark-700">{selectedType.Name}</h2>
                  {selectedType.IsDefault && <StatusBadge status="info" label="Default" size="sm" />}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" icon={<Edit className="w-3.5 h-3.5" />} onClick={() => openEditType(selectedType)}>
                    Edit
                  </Button>
                  <Button variant="danger" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => deleteModal.open(selectedType)}>
                    Delete
                  </Button>
                </div>
              </div>

              {/* Task type tabs */}
              <Tabs tabs={taskTypeTabs} activeTab={selectedTaskType} onChange={setSelectedTaskType} />

              {/* Statuses section */}
              <div className="rounded-lg border border-dark-200 bg-dark-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-dark-200 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-dark-600">
                    Statuses — {TASK_TYPE_LABELS[selectedTaskType]}
                  </h3>
                  <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreateStatus}>
                    Add Status
                  </Button>
                </div>
                <div className="p-3">
                  {statusesLoading ? (
                    <div className="flex justify-center py-8"><LoadingSpinner /></div>
                  ) : (
                    <DataTable<ProjectTypeStatus>
                      id="project-type-statuses"
                      columns={statusColumns}
                      data={statuses}
                      rowKey={(row) => row.StatusId || row.Id || ''}
                      onRowClick={openEditStatus}
                      emptyMessage="No statuses configured"
                    />
                  )}
                </div>
              </div>

              {/* Fields section */}
              <div className="rounded-lg border border-dark-200 bg-dark-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-dark-200">
                  <h3 className="text-sm font-medium text-dark-600">
                    Field Visibility — {TASK_TYPE_LABELS[selectedTaskType]}
                  </h3>
                </div>
                <div className="divide-y divide-dark-200">
                  {displayFields.map((f) => (
                    <div key={f.FieldName} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-sm text-dark-600">{FIELD_LABELS[f.FieldName] || f.FieldName}</span>
                      <div className="flex items-center gap-4">
                        <select
                          value={f.Visibility}
                          onChange={(e) =>
                            updateFieldMutation.mutate({ taskType: selectedTaskType, fieldName: f.FieldName, visibility: e.target.value })
                          }
                          className="form-input text-sm w-32"
                          title="Visibility"
                        >
                          <option value="visible">Visible</option>
                          <option value="read-only">Read-only</option>
                          <option value="hidden">Hidden</option>
                        </select>
                        <label className="flex items-center gap-1.5 text-xs text-dark-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={f.IsRequired}
                            onChange={(e) =>
                              updateFieldMutation.mutate({ taskType: selectedTaskType, fieldName: f.FieldName, isRequired: e.target.checked })
                            }
                            className="w-4 h-4 rounded border-dark-300"
                            title="Required"
                          />
                          Required
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Type Modal */}
      <Modal
        isOpen={typeModal.isOpen}
        onClose={typeModal.close}
        title={isEditingType ? 'Edit Project Type' : 'Add Project Type'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={typeModal.close}>Cancel</Button>
            <Button onClick={handleSaveType} loading={createTypeMutation.isPending || updateTypeMutation.isPending}>
              {isEditingType ? 'Save Changes' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Name" required>
            <input
              type="text"
              value={typeForm.name}
              onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
              className="form-input"
              placeholder="e.g. Internal, Client Project"
            />
          </FormField>
          <FormField label="Description">
            <textarea
              value={typeForm.description}
              onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
              className="form-input"
              rows={2}
              placeholder="Optional description"
            />
          </FormField>
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={typeForm.isDefault}
                onChange={(e) => setTypeForm({ ...typeForm, isDefault: e.target.checked })}
                className="sr-only peer"
                title="Default"
              />
              <div className="w-9 h-5 bg-dark-200 peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-dark-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary peer-checked:after:bg-dark" />
            </label>
            <span className="text-sm text-dark-600">Set as default</span>
          </div>
        </div>
      </Modal>

      {/* Delete Type Modal */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.close}
        title="Delete Project Type"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={deleteModal.close}>Cancel</Button>
            <Button variant="danger" onClick={() => deleteModal.data && deleteTypeMutation.mutate(deleteModal.data.Id)} loading={deleteTypeMutation.isPending}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-dark-500">
          Are you sure you want to delete <strong className="text-dark-700">{deleteModal.data?.Name}</strong>?
          This will remove all associated statuses and field configurations.
        </p>
      </Modal>

      {/* Create/Edit Status Modal */}
      <Modal
        isOpen={statusModal.isOpen}
        onClose={statusModal.close}
        title={isEditingStatus ? 'Edit Status' : 'Add Status'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={statusModal.close}>Cancel</Button>
            <Button onClick={handleSaveStatus} loading={createStatusMutation.isPending || updateStatusMutation.isPending}>
              {isEditingStatus ? 'Save Changes' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Label" required>
            <input
              type="text"
              value={statusForm.displayLabel}
              onChange={(e) => {
                setStatusForm({ ...statusForm, displayLabel: e.target.value });
                autoGenerateKey(e.target.value);
              }}
              className="form-input"
              placeholder="e.g. In Progress"
            />
          </FormField>
          <FormField label="Key" required>
            <input
              type="text"
              value={statusForm.statusValue}
              onChange={(e) => setStatusForm({ ...statusForm, statusValue: e.target.value })}
              className="form-input"
              placeholder="e.g. in-progress"
              disabled={isEditingStatus}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Color">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={statusForm.badgeColor}
                  onChange={(e) => setStatusForm({ ...statusForm, badgeColor: e.target.value })}
                  className="w-8 h-8 rounded border border-dark-300 cursor-pointer"
                  title="Badge color"
                />
                <input
                  type="text"
                  value={statusForm.badgeColor}
                  onChange={(e) => setStatusForm({ ...statusForm, badgeColor: e.target.value })}
                  className="form-input flex-1"
                  placeholder="#64748b"
                />
              </div>
            </FormField>
            <FormField label="Sort Order">
              <input
                type="number"
                value={statusForm.sortOrder}
                onChange={(e) => setStatusForm({ ...statusForm, sortOrder: parseInt(e.target.value) || 0 })}
                className="form-input"
                title="Sort order"
                placeholder="0"
                min={0}
              />
            </FormField>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-dark-600 cursor-pointer">
              <input
                type="checkbox"
                checked={statusForm.isDefault}
                onChange={(e) => setStatusForm({ ...statusForm, isDefault: e.target.checked })}
                className="w-4 h-4 rounded border-dark-300"
              />
              Default status
            </label>
            <label className="flex items-center gap-2 text-sm text-dark-600 cursor-pointer">
              <input
                type="checkbox"
                checked={statusForm.isFinal}
                onChange={(e) => setStatusForm({ ...statusForm, isFinal: e.target.checked })}
                className="w-4 h-4 rounded border-dark-300"
              />
              Terminal (final)
            </label>
          </div>
        </div>
      </Modal>

      {/* Delete Status Modal */}
      <Modal
        isOpen={deleteStatusModal.isOpen}
        onClose={deleteStatusModal.close}
        title="Delete Status"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={deleteStatusModal.close}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                const id = deleteStatusModal.data?.StatusId || deleteStatusModal.data?.Id;
                if (id) deleteStatusMutation.mutate(id);
              }}
              loading={deleteStatusMutation.isPending}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-dark-500">
          Are you sure you want to delete the status{' '}
          <strong className="text-dark-700">{deleteStatusModal.data?.DisplayLabel}</strong>?
        </p>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FormField (local helper)
// ---------------------------------------------------------------------------

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-dark-500 mb-1">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
